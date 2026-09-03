# النسخ الاحتياطي اليومي إلى Google Drive · Daily Google Drive Backup

نسخة احتياطية يومية تلقائية لبيانات "المخطط العام التفاعلي" (Firestore) تُحفظ في مجلّد
Google Drive **KEC-Interactive Map-Backups** — تعمل على خوادم Google، بدون الحاجة لتشغيل جهازك.

الملف `Code.gs` جاهز؛ عليك فقط ربطه بحساب Google Apps Script وضبط بضع قيم. الوقت المتوقّع: ~10 دقائق.

---

## الخطوات (بالترتيب)

### 1) أنشئ حساب "النسخ الاحتياطي" في Firebase (قراءة فقط)
1. افتح [Firebase Console](https://console.firebase.google.com/) → مشروع **interactive-master-plan**.
2. **Authentication → Users → Add user**.
3. البريد مثلاً: `backup@madinahkec.com` — وكلمة مرور قوية. احفظها.
4. هذا الحساب يبقى **Viewer** (قراءة فقط) في تطبيقك، وهذا كافٍ للنسخ الاحتياطي.

> لماذا حساب؟ بيانات الخريطة محميّة بتسجيل الدخول، فالسكربت يسجّل الدخول بهذا الحساب ليقرأ البيانات.

### 2) احصل على معرّف مجلّد Drive (Folder ID)
1. افتح مجلّد **KEC-Interactive Map-Backups** في Google Drive.
2. انسخ المعرّف من الرابط في المتصفح — الجزء بعد `folders/`:
   `https://drive.google.com/drive/folders/`**`1AbC...XYZ`** ← هذا هو `DRIVE_FOLDER_ID`.
3. تأكّد أن الحساب الذي ستستخدمه في Apps Script (نفس حساب Google) يملك المجلّد أو لديه صلاحية التعديل عليه.

### 3) أنشئ مشروع Apps Script والصق الكود
1. افتح [script.google.com](https://script.google.com/) → **New project**.
2. احذف المحتوى الافتراضي، والصق كامل محتوى `Code.gs` من هذا المجلّد.
3. سمِّ المشروع مثلاً: `KEC Map Backup`.

### 4) اضبط القيم السرّية (Script properties)
**Project Settings** (⚙️ على اليسار) → **Script properties** → أضف:

| Property | Value |
|---|---|
| `BACKUP_EMAIL` | البريد من الخطوة 1 (مثال `backup@madinahkec.com`) |
| `BACKUP_PASSWORD` | كلمة مرور ذلك الحساب |
| `DRIVE_FOLDER_ID` | المعرّف من الخطوة 2 |
| `RETENTION_DAYS` | (اختياري) عدد أيام الاحتفاظ، الافتراضي `30` |

`FB_API_KEY` و`FB_PROJECT_ID` مُعبّأة مسبقاً داخل الكود لهذا المشروع، فلا حاجة لإضافتها (إلا لو أردت تغييرها).

### 5) جرّب يدوياً وامنح الأذونات
1. من القائمة العلوية اختر الدالة **`runBackup`** ثم **Run**.
2. سيطلب Google أذونات (الاتصال بالخارج + الوصول إلى Drive) → **Allow**.
3. افتح **Executions** (يسار) للتأكد أنها انتهت بنجاح، ثم تحقّق من ظهور ملف
   `KEC-Map-Backup-YYYY-MM-DD.json` داخل المجلّد.

### 6) فعّل الجدولة اليومية
1. اختر الدالة **`installDailyTrigger`** ثم **Run** (مرّة واحدة).
2. تمّ — سيعمل النسخ تلقائياً كل يوم ~الساعة 2 صباحاً بتوقيت السكربت.
   (يمكنك رؤيته/تعديله من أيقونة **Triggers** ⏰ على اليسار.)

---

## الاستعادة عند الحاجة (نادراً)
> الاستعادة **تستبدل** البيانات الحالية — نفّذها بحذر.

1. الكتابة تحتاج حساب **مدير/محرّر** (له صلاحية الكتابة). أضِف في Script properties:
   `RESTORE_EMAIL` و`RESTORE_PASSWORD` لحساب أدمن (وإلا سيحاول السكربت بحساب النسخ الاحتياطي، وقد يُرفض).
2. شغّل **`listBackups`** ثم افتح **Executions/Logs** وانسخ معرّف الملف المطلوب.
3. في المحرّر نفِّذ `restoreFromFile('ضع_المعرّف_هنا')` (أو عدّل الدالة مؤقتاً لتمرير المعرّف).
4. أعد تحميل التطبيق لرؤية البيانات المستعادة.

---

## ماذا يحتوي ملف النسخة؟
JSON فيه وثائق مجموعة `kec_state` (`_core`, `attrs`, `projects`, `geom`) كما هي في Firestore،
حيث تُخزَّن البيانات في الحقل `b` (قد تكون مضغوطة بـ LZ). هذا كافٍ لاستعادة كامل الحالة إلى التطبيق.

## English (short)
`Code.gs` is a Google Apps Script that signs in to Firebase with a dedicated read-only
account, reads the `kec_state` collection, and saves a dated JSON snapshot into your Drive
folder daily, pruning ones older than `RETENTION_DAYS`.
Setup: (1) create a Firebase "backup" user, (2) copy the Drive folder id from its URL,
(3) paste `Code.gs` into a new script.google.com project, (4) add `BACKUP_EMAIL`,
`BACKUP_PASSWORD`, `DRIVE_FOLDER_ID` in Project Settings ▸ Script properties, (5) run
`runBackup` once and grant permissions, (6) run `installDailyTrigger` once. Restore with
`listBackups` then `restoreFromFile('<id>')` (needs an admin `RESTORE_EMAIL`/`RESTORE_PASSWORD`).
