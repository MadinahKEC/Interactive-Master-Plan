/**
 * KEC · Interactive Master Plan — Daily Google Drive backup
 * ---------------------------------------------------------
 * Runs on Google's servers (no PC needed). Once a day it:
 *   1. signs in to Firebase as a dedicated read-only "backup" account,
 *   2. reads the app's data from Firestore (collection `kec_state`),
 *   3. writes a dated JSON snapshot into your Drive folder
 *      "KEC-Interactive Map-Backups",
 *   4. deletes snapshots older than RETENTION_DAYS.
 *
 * You never paste secrets into this code — they live in Script Properties
 * (Project Settings ▸ Script properties). See README-backup.md for steps.
 */

// Firestore documents that make up the whole app state (see apps/web/src/lib/firebase.ts).
var STATE_DOCS = ['_core', 'attrs', 'projects', 'geom'];

/** Reads configuration from Script Properties. */
function getConfig_() {
  var p = PropertiesService.getScriptProperties();
  var cfg = {
    FB_API_KEY: p.getProperty('FB_API_KEY') || 'AIzaSyAhwGtgylvsY51wIyhg5y8MI85mVfAjWkI',
    FB_PROJECT_ID: p.getProperty('FB_PROJECT_ID') || 'interactive-master-plan',
    BACKUP_EMAIL: p.getProperty('BACKUP_EMAIL'),
    BACKUP_PASSWORD: p.getProperty('BACKUP_PASSWORD'),
    DRIVE_FOLDER_ID: p.getProperty('DRIVE_FOLDER_ID'),
    RETENTION_DAYS: Number(p.getProperty('RETENTION_DAYS') || 30)
  };
  if (!cfg.BACKUP_EMAIL || !cfg.BACKUP_PASSWORD) throw new Error('Set BACKUP_EMAIL and BACKUP_PASSWORD in Script properties.');
  if (!cfg.DRIVE_FOLDER_ID) throw new Error('Set DRIVE_FOLDER_ID (the id of the "KEC-Interactive Map-Backups" folder) in Script properties.');
  return cfg;
}

/** Signs in with the backup account and returns a Firebase ID token. */
function signIn_(cfg) {
  var res = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(cfg.FB_API_KEY),
    { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ email: cfg.BACKUP_EMAIL, password: cfg.BACKUP_PASSWORD, returnSecureToken: true }) });
  var body = res.getContentText();
  var j = JSON.parse(body);
  if (!j.idToken) throw new Error('Firebase sign-in failed: ' + body);
  return j.idToken;
}

/** Reads every state document from Firestore via the REST API. */
function fetchState_(cfg, idToken) {
  var out = {};
  for (var i = 0; i < STATE_DOCS.length; i++) {
    var id = STATE_DOCS[i];
    var url = 'https://firestore.googleapis.com/v1/projects/' + cfg.FB_PROJECT_ID +
      '/databases/(default)/documents/kec_state/' + encodeURIComponent(id);
    var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + idToken }, muteHttpExceptions: true });
    var code = res.getResponseCode();
    if (code === 200) out[id] = JSON.parse(res.getContentText());
    else if (code === 404) out[id] = null;            // slice not created yet — fine
    else throw new Error('Firestore read failed for "' + id + '" (HTTP ' + code + '): ' + res.getContentText());
  }
  return out;
}

/** MAIN — run daily by the trigger. Also safe to run by hand to test. */
function runBackup() {
  var cfg = getConfig_();
  var idToken = signIn_(cfg);
  var docs = fetchState_(cfg, idToken);

  var now = new Date();
  var tz = Session.getScriptTimeZone();
  var stamp = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var payload = {
    app: 'KEC · Interactive Master Plan',
    project: cfg.FB_PROJECT_ID,
    collection: 'kec_state',
    createdAt: now.toISOString(),
    note: 'Each document holds a packed (optionally LZ-compressed) blob in field "b". Restore by writing these documents back into kec_state.',
    docs: docs
  };

  var folder = DriveApp.getFolderById(cfg.DRIVE_FOLDER_ID);
  var name = 'KEC-Map-Backup-' + stamp + '.json';
  // Replace an existing snapshot for the same day so we keep one file per day.
  var same = folder.getFilesByName(name);
  while (same.hasNext()) same.next().setTrashed(true);
  folder.createFile(name, JSON.stringify(payload, null, 2), 'application/json');

  pruneOld_(folder, cfg.RETENTION_DAYS);
  Logger.log('Backup written: ' + name);
}

/** Trash snapshots older than `days`. */
function pruneOld_(folder, days) {
  if (!days || days <= 0) return;
  var cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    var m = /KEC-Map-Backup-(\d{4}-\d{2}-\d{2})\.json$/.exec(f.getName());
    if (m && new Date(m[1]).getTime() < cutoff) f.setTrashed(true);
  }
}

/** Run ONCE to schedule the daily backup (about 02:00 script-time). */
function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runBackup') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runBackup').timeBased().everyDays(1).atHour(2).create();
  Logger.log('Daily backup scheduled at ~02:00 ' + Session.getScriptTimeZone());
}

/* ============================ RESTORE (manual, rare) ============================
 * Writing back REPLACES the live data. Only run deliberately. Requires an admin/editor
 * account with write access — set RESTORE_EMAIL / RESTORE_PASSWORD in Script properties
 * (falls back to the backup account if your rules allow it to write). */

/** Logs the most recent backups so you can copy a file id for restore. */
function listBackups() {
  var folder = DriveApp.getFolderById(getConfig_().DRIVE_FOLDER_ID);
  var files = folder.getFilesByType('application/json');
  var rows = [];
  while (files.hasNext()) { var f = files.next(); rows.push(f.getName() + '  →  ' + f.getId()); }
  rows.sort().reverse();
  Logger.log(rows.join('\n') || 'No backups found.');
}

/** Restore the app's data from one backup file (pass its Drive file id from listBackups). */
function restoreFromFile(fileId) {
  if (!fileId) throw new Error('Pass a Drive file id — run listBackups() to find one.');
  var cfg = getConfig_();
  var p = PropertiesService.getScriptProperties();
  var email = p.getProperty('RESTORE_EMAIL') || cfg.BACKUP_EMAIL;
  var password = p.getProperty('RESTORE_PASSWORD') || cfg.BACKUP_PASSWORD;
  var idToken = signIn_({ FB_API_KEY: cfg.FB_API_KEY, BACKUP_EMAIL: email, BACKUP_PASSWORD: password });

  var payload = JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString());
  var docs = payload.docs || {};
  STATE_DOCS.forEach(function (id) {
    var d = docs[id];
    if (!d || !d.fields) return;
    var masks = Object.keys(d.fields).map(function (k) { return 'updateMask.fieldPaths=' + encodeURIComponent(k); }).join('&');
    var url = 'https://firestore.googleapis.com/v1/projects/' + cfg.FB_PROJECT_ID +
      '/databases/(default)/documents/kec_state/' + encodeURIComponent(id) + '?' + masks;
    var res = UrlFetchApp.fetch(url, { method: 'patch', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + idToken }, muteHttpExceptions: true,
      payload: JSON.stringify({ fields: d.fields }) });
    if (res.getResponseCode() !== 200) throw new Error('Restore failed for "' + id + '": ' + res.getContentText());
  });
  Logger.log('Restored from ' + payload.createdAt + '. Reload the app to see it.');
}
