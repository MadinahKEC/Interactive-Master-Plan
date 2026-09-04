/**
 * Domain layer for the KEC GIS experience: bilingual dictionary (AR/EN),
 * project-type & status catalogues, land-use → project-type inference, and the
 * project-progress overlay + placeholder gallery used by the luxury plot card.
 */
import { useEffect, useState } from 'react';

export type Lang = 'ar' | 'en';

// ---------- UI dictionary ----------
type Entry = { ar: string; en: string };
export const DICT: Record<string, Entry> = {
  'brand.title':      { ar: 'مدينة المعرفة الاقتصادية', en: 'Knowledge Economic City' },
  'brand.sub':        { ar: 'المخطط العام التفاعلي', en: 'Interactive Master Plan' },
  'tb.basemap':       { ar: 'الخلفية', en: 'Basemap' },
  'tb.light':         { ar: 'فاتح', en: 'Light' },
  'tb.satellite':     { ar: 'قمر صناعي', en: 'Satellite' },
  'tb.view':          { ar: 'العرض', en: 'View' },
  'tb.reset':         { ar: 'إعادة الضبط', en: 'Reset' },
  'tb.langToggle':    { ar: 'EN', en: 'ع' },
  'cp.search':        { ar: 'ابحث برمز البلوت… مثل S19', en: 'Search plot code… e.g. S19' },
  'cp.sectors':       { ar: 'القطاعات', en: 'Sectors' },
  'cp.plotsWord':     { ar: 'بلوت', en: 'plots' },
  'cp.uses':          { ar: 'الاستخدامات', en: 'Land Uses' },
  'cp.filterHint':    { ar: 'اضغط للتصفية', en: 'tap to filter' },
  'cp.all':           { ar: 'الكل', en: 'All' },
  'kpi.count':        { ar: 'عدد البلوت', en: 'Plots' },
  'kpi.uses':         { ar: 'عدد الاستخدامات', en: 'Land uses' },
  'kpi.gfa':          { ar: 'إجمالي GFA (م²)', en: 'Total GFA (m²)' },
  'kpi.area':         { ar: 'إجمالي المساحة (م²)', en: 'Total area (m²)' },
  'd.sector':         { ar: 'القطاع', en: 'Sector' },
  'd.floors':         { ar: 'الأدوار', en: 'Floors' },
  'd.area':           { ar: 'المساحة (م²)', en: 'Area (m²)' },
  'd.gfa':            { ar: 'المسطح الإجمالي GFA (م²)', en: 'GFA (m²)' },
  'd.height':         { ar: 'الارتفاع (م)', en: 'Height (m)' },
  'd.coverage':       { ar: 'نسبة التغطية', en: 'Coverage' },
  'd.far':            { ar: 'معامل الاستغلال FAR', en: 'FAR' },
  'd.elecLoad':       { ar: 'الحمولة الكهربائية المتوقعة (ك.ف.أ)', en: 'Expected electrical load (kVA)' },
  'd.manual':         { ar: 'يدوي', en: 'Manual' },
  'd.resize':         { ar: 'اسحب لتغيير حجم البطاقة', en: 'Drag to resize card' },
  'd.landuse':        { ar: 'الاستخدام', en: 'Land use' },
  'd.unnamed':        { ar: 'لم تُسمّ بعد', en: 'Not yet named' },
  'd.progress':       { ar: 'نسبة الإنجاز', en: 'Progress' },
  'd.zoom':           { ar: 'تكبير للبلوت', en: 'Zoom to plot' },
  'd.editAttrs':      { ar: 'تعديل السمات', en: 'Edit attributes' },
  'd.rename':         { ar: 'إعادة تسمية', en: 'Rename' },
  'd.gallery':        { ar: 'مراحل تقدّم المشروع', en: 'Project progress' },
  'd.note':           { ar: 'التعديل وإعادة التسمية وتعديل المضلع تُحفظ عبر الـ API مع سجل تدقيق.', en: 'Edits, rename and geometry changes persist via the API with an audit trail.' },
  'stage.foundation': { ar: 'الأساسات', en: 'Foundation' },
  'stage.structure':  { ar: 'الهيكل', en: 'Structure' },
  'stage.facade':     { ar: 'الواجهات', en: 'Façade' },
  'stage.handover':   { ar: 'التسليم', en: 'Handover' },
  'loading':          { ar: 'جارٍ تحميل المخطط العام…', en: 'Loading the master plan…' },
  'credit':           { ar: 'مدينة المعرفة الاقتصادية · بيانات المخطط: GIS KEC (958 بلوت)', en: 'Knowledge Economic City · Master-plan data: GIS KEC (958 plots)' },
  'tb.admin':        { ar: 'وحدة التحكم', en: 'Admin' },
  'tb.logout':       { ar: 'تسجيل الخروج', en: 'Sign out' },
  'role.administrator': { ar: 'مدير', en: 'Admin' },
  'role.editor':     { ar: 'محرّر', en: 'Editor' },
  'role.contributor':{ ar: 'مساهم', en: 'Contributor' },
  'role.viewer':     { ar: 'مستعرض', en: 'Viewer' },
  'a.title':         { ar: 'وحدة التحكم', en: 'Admin Console' },
  'a.dashboard':     { ar: 'لوحة القيادة', en: 'Dashboard' },
  'a.plots':         { ar: 'البلوت', en: 'Plots' },
  'a.landuses':      { ar: 'الاستخدامات', en: 'Land Uses' },
  'a.users':         { ar: 'المستخدمون', en: 'Users' },
  'a.grpData':       { ar: 'البيانات', en: 'Data' },
  'a.grpAdmin':      { ar: 'الإدارة', en: 'Administration' },
  'a.grpSystem':     { ar: 'النظام', en: 'System' },
  'a.grpGeneral':    { ar: 'عام', en: 'General' },
  'a.grpBackup':     { ar: 'البيانات والنسخ الاحتياطي', en: 'Data & Backup' },
  'a.grpDanger':     { ar: 'منطقة حسّاسة', en: 'Danger zone' },
  'bk.restoreTitle': { ar: 'الاستعادة من نسخة Drive', en: 'Restore from a Drive backup' },
  'bk.browse':       { ar: 'استعراض النسخ', en: 'Browse backups' },
  'bk.hideList':     { ar: 'إخفاء القائمة', en: 'Hide list' },
  'bk.hint':         { ar: 'اختر يوماً لاستعادته — سيتم استبدال البيانات الحالية بنسخة ذلك اليوم.', en: 'Choose a day to restore — the current data will be replaced with that day’s snapshot.' },
  'bk.webUrl':       { ar: 'رابط تطبيق الويب (/exec)', en: 'Web app URL (/exec)' },
  'bk.token':        { ar: 'الرمز السري', en: 'Secret token' },
  'bk.connect':      { ar: 'اتصال وتحديث', en: 'Connect & refresh' },
  'bk.needConfig':   { ar: 'أدخل رابط تطبيق الويب والرمز السري ثم اضغط اتصال.', en: 'Enter the web app URL and secret token, then Connect.' },
  'bk.loading':      { ar: 'جارٍ قراءة النسخ…', en: 'Reading backups…' },
  'bk.none':         { ar: 'لا توجد نسخ احتياطية بعد في المجلّد.', en: 'No backups found in the folder yet.' },
  'bk.restore':      { ar: 'استعادة', en: 'Restore' },
  'bk.restoreConfirm': { ar: 'سيتم استبدال جميع البيانات الحالية بنسخة هذا اليوم:', en: 'All current data will be replaced with this day’s snapshot:' },
  'bk.err':          { ar: 'تعذّر الاتصال بالنسخ — تحقّق من الرابط والرمز.', en: 'Could not reach the backups — check the URL and token.' },
  'bk.done':         { ar: 'تمت الاستعادة — سيُعاد تحميل الصفحة.', en: 'Restored — reloading…' },
  'bk.size':         { ar: 'الحجم', en: 'Size' },
  'a.audit':         { ar: 'سجل التغييرات', en: 'Change Log' },
  'a.auditHint':     { ar: 'كل إضافة أو تعديل أو حذف — الأحدث أولاً، مع مَن قام به ومتى. التراجع متاح للمدير خلال الجلسة الحالية.', en: 'Every add, edit or delete — newest first, with who did it and when. Undo is available to admins within the current session.' },
  'a.undoLast':      { ar: 'تراجع عن آخر تغيير', en: 'Undo last change' },
  'cl.changes':      { ar: 'تغييرات', en: 'changes' },
  'cl.people':       { ar: 'مستخدمين', en: 'people' },
  'cl.today':        { ar: 'اليوم', en: 'Today' },
  'cl.yesterday':    { ar: 'أمس', en: 'Yesterday' },
  'cl.filter':       { ar: 'تصفية حسب المستخدم أو الإجراء أو السجل…', en: 'Filter by user, action, record…' },
  'cl.export':       { ar: 'تصدير CSV', en: 'Export CSV' },
  'cl.clear':        { ar: 'مسح السجل', en: 'Clear' },
  'cl.clearConfirm': { ar: 'سيتم مسح سجل التغييرات بالكامل. لا يمكن التراجع عن هذا.', en: 'The entire change log will be cleared. This cannot be undone.' },
  'cl.empty':        { ar: 'لا توجد تغييرات بعد.', en: 'No changes recorded yet.' },
  'cl.emptyFilter':  { ar: 'لا يوجد تغيير مطابق للتصفية.', en: 'No change matches that filter.' },
  'cl.added':        { ar: 'إضافة', en: 'added' },
  'cl.edited':       { ar: 'تعديل', en: 'edited' },
  'cl.deleted':      { ar: 'حذف', en: 'deleted' },
  'cl.olderNote':    { ar: 'من جلسة سابقة', en: 'earlier session' },
  'a.access':        { ar: 'سجل الدخول', en: 'Access Log' },
  'a.location':      { ar: 'الموقع', en: 'Location' },
  'a.device':        { ar: 'الجهاز', en: 'Device' },
  'a.duration':      { ar: 'مدة الجلسة', en: 'Session' },
  'a.noSessions':    { ar: 'لا توجد جلسات مسجّلة بعد', en: 'No sessions recorded yet' },
  'a.mostViewed':    { ar: 'الأكثر مشاهدة', en: 'Most viewed' },
  'a.settings':      { ar: 'الإعدادات', en: 'Settings' },
  'a.search':        { ar: 'بحث…', en: 'Search…' },
  'a.save':          { ar: 'حفظ', en: 'Save' },
  'a.cancel':        { ar: 'إلغاء', en: 'Cancel' },
  'a.projectInfo':   { ar: 'بيانات المشروع', en: 'Project info' },
  'a.plotAttrs':     { ar: 'سمات البلوت', en: 'Plot attributes' },
  'a.elecLoad':      { ar: 'الحمولة الكهربائية (ك.ف.أ)', en: 'Electrical load (kVA)' },
  'a.elecLoadAuto':  { ar: 'تلقائي', en: 'Auto' },
  'a.elecLoadHint':  { ar: 'يُحسب تلقائياً من المسطح الإجمالي والاستخدام وفق الكود السعودي لشركة الكهرباء. اتركه فارغاً للحساب التلقائي، أو أدخل رقماً لتجاوزه يدوياً.', en: 'Auto-calculated from GFA and land use per the Saudi Electricity code. Leave empty for auto, or enter a number to override manually.' },
  'a.nameAr':        { ar: 'الاسم (عربي)', en: 'Name (Arabic)' },
  'a.nameEn':        { ar: 'الاسم (إنجليزي)', en: 'Name (English)' },
  'a.type':          { ar: 'النوع', en: 'Type' },
  'a.status':        { ar: 'الحالة', en: 'Status' },
  'a.progress':      { ar: 'نسبة الإنجاز', en: 'Progress' },
  'a.stage':         { ar: 'مرحلة المشروع', en: 'Project stage' },
  'a.stageNone':     { ar: 'لم تبدأ', en: 'Not started' },
  'a.images':        { ar: 'صور الأرض (إرفاق)', en: 'Plot images (attach)' },
  'a.summaryAr':     { ar: 'نبذة (عربي)', en: 'Summary (Arabic)' },
  'a.summaryEn':     { ar: 'نبذة (إنجليزي)', en: 'Summary (English)' },
  'a.gallery':       { ar: 'روابط الصور (بفاصلة)', en: 'Image URLs (comma-separated)' },
  'a.landuse':       { ar: 'الاستخدام', en: 'Land use' },
  'a.sector':        { ar: 'القطاع', en: 'Sector' },
  'a.color':         { ar: 'اللون', en: 'Color' },
  'a.addUser':       { ar: 'إضافة مستخدم', en: 'Add user' },
  'a.name':          { ar: 'الاسم', en: 'Name' },
  'a.email':         { ar: 'البريد', en: 'Email' },
  'a.username':      { ar: 'اسم المستخدم', en: 'Username' },
  'a.password':      { ar: 'كلمة المرور', en: 'Password' },
  'a.role':          { ar: 'الدور', en: 'Role' },
  'a.active':        { ar: 'نشط', en: 'Active' },
  'a.remove':        { ar: 'حذف', en: 'Remove' },
  'a.removeUser':    { ar: 'حذف المستخدم', en: 'Remove user' },
  'a.removeUserConfirm': { ar: 'سيتم حذف هذا المستخدم وإلغاء وصوله نهائياً.', en: 'This user will be permanently removed and lose access.' },
  'a.export':        { ar: 'تصدير البيانات', en: 'Export data' },
  'a.import':        { ar: 'استيراد البيانات', en: 'Import data' },
  'a.reset':         { ar: 'إعادة تعيين', en: 'Reset' },
  'a.addLanduse':    { ar: 'إضافة استخدام', en: 'Add land use' },
  'a.removedLanduses': { ar: 'استخدامات محذوفة (اضغط للاسترجاع):', en: 'Removed (tap to restore):' },
  'a.resetConfirm':  { ar: 'حذف كل التعديلات المحلية؟', en: 'Delete all local edits?' },
  'a.planStyle':     { ar: 'تنسيق قطع خطة التطوير', en: 'Development-plan plot styling' },
  'a.planStyleHint': { ar: 'يُطبَّق على كل بلوت داخل خطة التطوير', en: 'Applied to every plot inside the development plan' },
  'a.planOutlineStatus': { ar: 'لون الإطار حسب الحالة (مرتبط بالفلاتر)', en: 'Border colour by status (linked to filters)' },
  'a.planOutline':   { ar: 'لون إطار مخصّص', en: 'Custom outline colour' },
  'a.planDash':      { ar: 'إطار متقطّع', en: 'Dashed outline' },
  'a.planGlow':      { ar: 'هالة حسب الحالة', en: 'Status glow' },
  'a.planOutlineW':  { ar: 'سماكة الإطار', en: 'Outline width' },
  'a.planDashLen':   { ar: 'طول الشرطة', en: 'Dash length' },
  'a.planDashGap':   { ar: 'فراغ الشرطة', en: 'Dash gap' },
  'a.planGlowW':     { ar: 'سماكة الهالة', en: 'Glow width' },
  'a.byLandUse':     { ar: 'التوزيع حسب الاستخدام', en: 'By land use' },
  'a.bySector':      { ar: 'التوزيع حسب القطاع', en: 'By sector' },
  'a.byStatus':      { ar: 'حالة المشاريع', en: 'Project status' },
  'a.named':         { ar: 'مشاريع مُسمّاة', en: 'Named projects' },
  'a.edited':        { ar: 'بلوت مُعدّلة', en: 'Edited plots' },
  'a.time':          { ar: 'الوقت', en: 'Time' },
  'a.actor':         { ar: 'المُنفِّذ', en: 'Actor' },
  'a.action':        { ar: 'الإجراء', en: 'Action' },
  'a.target':        { ar: 'الهدف', en: 'Target' },
  'a.detail':        { ar: 'التفاصيل', en: 'Details' },
  'a.noEdits':       { ar: 'لا توجد تعديلات بعد', en: 'No edits yet' },
  'a.rowsHint':      { ar: 'اضغط أي صف للتعديل', en: 'Click a row to edit' },
  'a.merges':        { ar: 'عمليات الدمج', en: 'Merges' },
  'a.ownership':     { ar: 'الملكية', en: 'Ownership' },
  'a.owner':         { ar: 'المالك / المستثمر', en: 'Owner / Investor' },
  'sec.ownership':   { ar: 'الملكية', en: 'Ownership' },
  'sec.project':     { ar: 'حالة المشروع والتراخيص', en: 'Status & permits' },
  'sec.summary':     { ar: 'نبذة عن المشروع', en: 'Overview' },
  'sec.gallery':     { ar: 'الصور', en: 'Gallery' },
  'sec.land':        { ar: 'بيانات الأرض', en: 'Land data' },
  'd.owner':         { ar: 'المالك / المستثمر', en: 'Owner / Investor' },
  'd.ownership':     { ar: 'حالة الملكية', en: 'Ownership status' },
  'd.purchase':      { ar: 'تاريخ الشراء', en: 'Purchase date' },
  'd.editShape':     { ar: 'تعديل الشكل', en: 'Edit shape' },
  'd.fullPlan':      { ar: 'عرض المخطط كاملاً', en: 'Full plan view' },
  'g.title':         { ar: 'وضع تعديل الشكل', en: 'Shape editing mode' },
  'g.hint':          { ar: 'اسحب الرؤوس لإعادة التشكيل · انقر منتصف ضلع لإضافة رأس · نقر مزدوج على رأس لحذفه', en: 'Drag vertices to reshape · click an edge midpoint to add · double-click a vertex to delete' },
  'g.save':          { ar: 'حفظ الشكل', en: 'Save shape' },
  'g.cancel':        { ar: 'إلغاء', en: 'Cancel' },
  'g.reset':         { ar: 'استعادة الأصل', en: 'Reset original' },
  'm.selected':      { ar: 'بلوت مُحدّدة', en: 'plots selected' },
  'm.totalArea':     { ar: 'إجمالي المساحة (م²)', en: 'Total area (m²)' },
  'm.totalGfa':      { ar: 'إجمالي GFA (م²)', en: 'Total GFA (m²)' },
  'm.merge':         { ar: 'دمج المحدّد', en: 'Merge selected' },
  'm.mergeHint':     { ar: 'دمج البلوت المحدّدة في وحدة ملكية واحدة', en: 'Merge selected plots into one ownership unit' },
  'm.clear':         { ar: 'مسح التحديد', en: 'Clear selection' },
  'm.aggregate':     { ar: 'ملخّص الأراضي المحدّدة', en: 'Selection summary' },
  'm.totalElec':     { ar: 'الحمولة الكهربائية (ك.ف.أ)', en: 'Electrical load (kVA)' },
  'm.avgFar':        { ar: 'متوسط FAR', en: 'Avg FAR' },
  'm.landUses':      { ar: 'الاستخدامات', en: 'Land uses' },
  'm.inPlan':        { ar: 'ضمن الخطة', en: 'In plan' },
  'm.byUse':         { ar: 'التوزيع حسب الاستخدام', en: 'By land use' },
  'm.otherUses':     { ar: 'أخرى', en: 'Other' },
  'm.mergeTitle':    { ar: 'دمج الأراضي المحدّدة', en: 'Merge selected plots' },
  'm.mergeBody':     { ar: 'سيتم دمج {n} قطع في وحدة ملكية واحدة. اختر اسماً للقطعة الناتجة — يمكنك تعديله لاحقاً من بطاقة البلوت.', en: '{n} plots will be merged into a single ownership unit. Choose a name for the result — you can change it later from the plot card.' },
  'm.mergeName':     { ar: 'اسم القطعة بعد الدمج', en: 'Merged plot name' },
  'm.mergeNamePh':   { ar: 'مثال: مجمّع الأعمال المركزي', en: 'e.g. Central Business Complex' },
  'm.removeFromPlanConfirm': { ar: 'سيتم إزالة البلوت المحدّدة من خطة التطوير.', en: 'The selected plots will be removed from the development plan.' },
  'cp.searchAny':    { ar: 'ابحث: كود، مشروع، مساحة، مستثمر…', en: 'Search: code, project, area, investor…' },
  'cp.planTitle':    { ar: 'خطة التطوير', en: 'Development plan' },
  'cp.planOnly':     { ar: 'إظهار قطع الخطة فقط', en: 'Show planned plots only' },
  'cp.planned':      { ar: 'ضمن الخطة', en: 'in plan' },
  'd.removeFromPlan':{ ar: 'إزالة من خطة التطوير', en: 'Remove from development plan' },
  'd.subdivide':     { ar: 'تقسيم البلوت', en: 'Subdivide' },
  'sub.title':       { ar: 'تقسيم البلوت', en: 'Subdivide plot' },
  'sub.preset':      { ar: 'تحميل قالب Multaqa', en: 'Load Multaqa preset' },
  'sub.addPart':     { ar: 'إضافة قطعة', en: 'Add part' },
  'sub.apply':       { ar: 'تنفيذ التقسيم', en: 'Apply subdivision' },
  'sub.undo':        { ar: 'إعادة الدمج كقطعة واحدة', en: 'Merge back to one plot' },
  'sub.targetArea':  { ar: 'المساحة المستهدفة (م²)', en: 'Target area (m²)' },
  'sub.parts':       { ar: 'القطع', en: 'Parts' },
  'sub.hint':        { ar: 'تُقسَّم الأرض بأشكال متناسبة مع المساحات المدخلة، والبيانات تُحسب حسب شكل كل قطعة.', en: 'The plot is split into shapes proportional to the entered areas; data is scaled to each piece.' },
  'sub.presetHint':  { ar: 'الأشكال الخمسة مطابقة تماماً لمخطط Multaqa Park Side الرسمي.', en: 'The five shapes match the official Multaqa Park Side plan exactly.' },
  'sub.already':     { ar: 'هذه الأرض مقسّمة حالياً', en: 'This plot is currently subdivided' },
  'sub.mergeInfo':   { ar: 'ستعود الأرض برقمها الأصلي مع الحفاظ على جميع التفاصيل والصور المُضافة.', en: 'The plot returns under its original code with all its details and images preserved.' },
  'sub.needParts':   { ar: 'أضف قطعتين على الأقل', en: 'Add at least two parts' },
  'shape.title':     { ar: 'تحديث مساحة البلوت بعد تعديل الشكل', en: 'Update plot area after reshaping' },
  'shape.intro':     { ar: 'بعد تعديل شكل البلوت أصبحت مساحته المحسوبة كالتالي. يمكنك تطبيق القيم الجديدة، أو تعديلها يدوياً، أو الإبقاء على المساحة الحالية.', en: 'After reshaping, the recomputed figures are shown below. You can apply the new values, edit them, or keep the current area.' },
  'shape.current':   { ar: 'الحالية', en: 'Current' },
  'shape.new':       { ar: 'الجديدة', en: 'New' },
  'shape.apply':     { ar: 'تطبيق القيم', en: 'Apply values' },
  'shape.keep':      { ar: 'المحافظة على الحالية', en: 'Keep current' },
  'audit.revert':    { ar: 'تراجع', en: 'Revert' },
  'audit.revertTitle': { ar: 'التراجع عن التعديل', en: 'Revert this change' },
  'audit.revertBody':  { ar: 'سيعود المشروع إلى حالته قبل هذا التعديل مباشرةً، مع إلغاء هذا التعديل وكل ما تلاه. هل تريد المتابعة؟', en: 'The project returns to its state just before this change; this change and everything after it are undone. Continue?' },
  'audit.reverted':  { ar: 'تم التراجع', en: 'Reverted' },
  'g.addPoint':      { ar: 'انقر على أي ضلع لإضافة نقطة · اسحب النقاط لتعديل الشكل · نقرة مزدوجة لحذف نقطة', en: 'Click an edge to add a point · drag points to reshape · double-click a point to remove it' },
  'share.title':     { ar: 'مشاركة', en: 'Share' },
  'share.hint':      { ar: 'رابط يفتح هذه الوجهة مباشرةً على الخريطة، أو امسح رمز QR.', en: 'A link that opens this view directly on the map, or scan the QR code.' },
  'share.copy':      { ar: 'نسخ الرابط', en: 'Copy link' },
  'share.copied':    { ar: 'تم النسخ ✓', en: 'Copied ✓' },
  'share.qr':        { ar: 'تنزيل رمز QR', en: 'Download QR' },
  'd.share':         { ar: 'مشاركة', en: 'Share' },
  'd.favorite':      { ar: 'إضافة للمفضّلة', en: 'Add to shortlist' },
  'd.unfavorite':    { ar: 'إزالة من المفضّلة', en: 'Remove from shortlist' },
  'sl.title':        { ar: 'المفضّلة', en: 'Shortlist' },
  'sl.compare':      { ar: 'مقارنة', en: 'Compare' },
  'sl.clear':        { ar: 'مسح الكل', en: 'Clear all' },
  'cmp.title':       { ar: 'مقارنة البلوتات', en: 'Plot comparison' },
  'd.status':        { ar: 'الحالة', en: 'Status' },
  'tb.measure':      { ar: 'القياس', en: 'Measure' },
  'tb.earth':        { ar: 'عرض ثلاثي الأبعاد (Earth)', en: '3D Earth view' },
  'tb.layers':       { ar: 'الطبقات والعرض', en: 'Layers & view' },
  'tb.hideMenu':     { ar: 'إخفاء القائمة', en: 'Hide menu' },
  'tb.showMenu':     { ar: 'إظهار القائمة', en: 'Show menu' },
  'lf.title':        { ar: 'الطبقات والعرض', en: 'Layers & view' },
  'lf.overlays':     { ar: 'الطبقات المعروضة', en: 'Overlays' },
  'view.2d':         { ar: 'مسطّح 2D', en: '2D' },
  'view.3d':         { ar: 'مجسّمات 3D', en: '3D Massing' },
  'view.earth':      { ar: 'الأرض 3D', en: '3D Earth' },
  'view.2dHint':     { ar: 'عرض علوي مسطّح للمخطط', en: 'Flat top-down plan view' },
  'view.3dHint':     { ar: 'إبراز مجسّمات القطع حسب الارتفاع', en: 'Extruded plot volumes by height' },
  'view.earthHint':  { ar: 'صور قمر صناعية فوق تضاريس ومبانٍ ثلاثية الأبعاد', en: 'Satellite over real terrain + 3D buildings' },
  'view.fly':        { ar: '▶ جولة سينمائية ثلاثية الأبعاد', en: '▶ Cinematic 3D fly-through' },
  'view.flyStop':    { ar: '⏹ إيقاف الجولة', en: '⏹ Stop fly-through' },
  'tb.labels':       { ar: 'إظهار أرقام البلوتات', en: 'Show plot numbers' },
  'cp.landmarks':    { ar: 'إظهار معالم المدينة المنورة', en: 'Show Madinah landmarks' },
  'sec.invest':      { ar: 'أبرز المؤشرات الاستثمارية', en: 'Investment highlights' },
  'sec.analysis':    { ar: 'التحليل الاستثماري', en: 'Investment analysis' },
  'sec.investors':   { ar: 'المستثمرون المهتمّون', en: 'Interested investors' },
  'iv.add':          { ar: 'إضافة مستثمر مهتم', en: 'Add interested investor' },
  'iv.name':         { ar: 'اسم المستثمر / الجهة', en: 'Investor / company' },
  'iv.contact':      { ar: 'وسيلة التواصل', en: 'Contact' },
  'iv.note':         { ar: 'ملاحظة', en: 'Note' },
  'iv.status':       { ar: 'الحالة', en: 'Status' },
  'iv.empty':        { ar: 'لا يوجد مستثمرون مسجّلون بعد.', en: 'No investors logged yet.' },
  'iv.save':         { ar: 'إضافة', en: 'Add' },
  'iv.count':        { ar: 'مهتمّ', en: 'interested' },
  'ia.score':        { ar: 'درجة الجاذبية الاستثمارية', en: 'Investment attractiveness' },
  'ia.haram':        { ar: 'المسافة إلى الحرم', en: 'Distance to the Haram' },
  'ia.factors':      { ar: 'العوامل', en: 'Factors' },
  'ia.feasibility':  { ar: 'حاسبة الجدوى', en: 'Feasibility calculator' },
  'ia.disclaimer':   { ar: 'تقديرات إرشادية غير مُلزمة، تُبنى على المعطيات والافتراضات المُدخلة.', en: 'Indicative estimates only, based on the data and assumptions entered.' },
  'fe.title':        { ar: 'حاسبة الجدوى الاستثمارية', en: 'Feasibility calculator' },
  'fe.gsa':          { ar: 'المساحة القابلة للبيع (م²)', en: 'Gross saleable area (m²)' },
  'fe.salePrice':    { ar: 'سعر البيع للمتر (ر.س)', en: 'Sale price / m² (SAR)' },
  'fe.buildCost':    { ar: 'تكلفة البناء للمتر (ر.س)', en: 'Build cost / m² (SAR)' },
  'fe.landCost':     { ar: 'تكلفة الأرض (ر.س)', en: 'Land cost (SAR)' },
  'fe.softPct':      { ar: 'التكاليف الأخرى (% من البناء)', en: 'Soft costs (% of build)' },
  'fe.devMonths':    { ar: 'مدة التطوير (شهر)', en: 'Development period (months)' },
  'fe.salesMonths':  { ar: 'مدة البيع (شهر)', en: 'Sales period (months)' },
  'fe.discount':     { ar: 'معدل الخصم السنوي (%)', en: 'Annual discount rate (%)' },
  'fe.revenue':      { ar: 'إجمالي الإيرادات', en: 'Total revenue' },
  'fe.cost':         { ar: 'إجمالي التكلفة', en: 'Total cost' },
  'fe.profit':       { ar: 'صافي الربح', en: 'Net profit' },
  'fe.roi':          { ar: 'العائد على الاستثمار', en: 'ROI' },
  'fe.moic':         { ar: 'مضاعف رأس المال', en: 'MOIC' },
  'fe.npv':          { ar: 'صافي القيمة الحالية', en: 'NPV' },
  'fe.irr':          { ar: 'العائد الداخلي (سنوي)', en: 'IRR (annual)' },
  'fe.payback':      { ar: 'فترة الاسترداد', en: 'Payback' },
  'fe.inputs':       { ar: 'الافتراضات', en: 'Assumptions' },
  'fe.results':      { ar: 'النتائج', en: 'Results' },
  'fe.months':       { ar: 'شهر', en: 'mo' },
  'fe.saveToPlot':   { ar: 'حفظ في مؤشرات البلوت', en: 'Save to plot highlights' },
  'fe.sensitivity':  { ar: 'تحليل الحساسية', en: 'Sensitivity analysis' },
  'fe.priceSens':    { ar: 'حساسية سعر البيع', en: 'Sale-price sensitivity' },
  'fe.costSens':     { ar: 'حساسية تكلفة البناء', en: 'Build-cost sensitivity' },
  'fe.sensHint':     { ar: 'العائد الداخلي (IRR) عند تغيّر الافتراض ±20%', en: 'Project IRR as the assumption shifts ±20%' },
  'a.invest':        { ar: 'المؤشرات الاستثمارية', en: 'Investment highlights' },
  'dp.desc':         { ar: 'وصف خطة التطوير', en: 'Development plan overview' },
  'dp.descAr':       { ar: 'خطة التطوير (عربي)', en: 'Development plan (Arabic)' },
  'dp.descEn':       { ar: 'خطة التطوير (إنجليزي)', en: 'Development plan (English)' },
  'sec.collapse':    { ar: 'طيّ / إظهار', en: 'Collapse / expand' },
  'cp.labels':       { ar: 'إظهار أرقام القطع على الخريطة', en: 'Show plot numbers on map' },
  'd.pdf':           { ar: 'بطاقة PDF', en: 'PDF factsheet' },
  'iv2.type':        { ar: 'نوع الاستثمار', en: 'Investment type' },
  'iv2.pricePerM':   { ar: 'سعر المتر', en: 'Price / m²' },
  'iv2.dealValue':   { ar: 'قيمة الصفقة', en: 'Deal value' },
  'iv2.loading':     { ar: 'جارٍ جلب المستثمرين…', en: 'Loading investors…' },
  'iv2.error':       { ar: 'تعذّر الاتصال بسجل المستثمرين', en: 'Could not reach the investor log' },
  'a.cardLayout':    { ar: 'إظهار / إخفاء حقول وبطاقات البلوت', en: 'Show / hide plot fields & cards' },
  'a.cardLayoutHint':{ ar: 'اضغط على أي عنصر لإخفائه من بطاقة العرض للجميع، واضغط مرة أخرى لإرجاعه. للعرض فقط — لا يحذف البيانات.', en: 'Tap any item to remove it from the viewer card for everyone; tap again to restore. Display only — data is never deleted.' },
  'a.grpSections':   { ar: 'الأقسام', en: 'Sections' },
  'a.grpLandFields': { ar: 'حقول بيانات الأرض', en: 'Land-data fields' },
  'a.grpInvFields':  { ar: 'حقول الاستثمار', en: 'Investment fields' },
  'pf.title':        { ar: 'بطاقة بلوت', en: 'Plot Factsheet' },
  'dash.gfaSector':  { ar: 'إجمالي GFA حسب القطاع', en: 'Total GFA by sector' },
  'dash.permits':    { ar: 'التراخيص الصادرة', en: 'Permits issued' },
  'dash.noPermits':  { ar: 'لا توجد تراخيص مُسجّلة بعد', en: 'No permits recorded yet' },
  'sc.title':        { ar: 'اختصارات لوحة المفاتيح', en: 'Keyboard shortcuts' },
  'tb.create':       { ar: 'إنشاء بلوت جديد', en: 'Create plot' },
  'cr.title':        { ar: 'إنشاء بلوت جديد', en: 'Create new plot' },
  'cr.hint':        { ar: 'انقر على الخريطة لرسم حدود البلوت', en: 'Click on the map to draw the plot outline' },
  'cr.points':       { ar: 'نقاط', en: 'points' },
  'cr.area':         { ar: 'المساحة المحسوبة', en: 'Computed area' },
  'cr.code':         { ar: 'رمز البلوت', en: 'Plot code' },
  'cr.save':         { ar: 'حفظ البلوت', en: 'Save plot' },
  'cr.undo':         { ar: 'تراجع عن نقطة', en: 'Undo point' },
  'd.deletePlot':    { ar: 'حذف البلوت', en: 'Delete plot' },
  'd.deletePlotConfirm': { ar: 'سيتم حذف هذا البلوت نهائياً:', en: 'This plot will be permanently deleted:' },
  'sec.comments':    { ar: 'التعليقات', en: 'Comments' },
  'cm.placeholder':  { ar: 'أضف تعليقاً…', en: 'Add a comment…' },
  'cm.add':          { ar: 'إضافة', en: 'Post' },
  'cm.empty':        { ar: 'لا توجد تعليقات بعد.', en: 'No comments yet.' },
  'cm.delete':       { ar: 'حذف التعليق', en: 'Delete comment' },
  'cm.deleteConfirm':{ ar: 'سيتم حذف هذا التعليق نهائياً.', en: 'This comment will be permanently deleted.' },
  'meas.title':      { ar: 'أداة القياس', en: 'Measurement' },
  'meas.hint':       { ar: 'انقر لإضافة نقاط · انقر نقرة مزدوجة للإنهاء', en: 'Click to add points · double-click to finish' },
  'meas.distance':   { ar: 'المسافة', en: 'Distance' },
  'meas.area':       { ar: 'المساحة', en: 'Area' },
  'meas.clear':      { ar: 'مسح', en: 'Clear' },
  'meas.done':       { ar: 'إنهاء', en: 'Done' },
  'meas.time':       { ar: 'الزمن المُقدَّر', en: 'Estimated time' },
  'meas.walk':       { ar: 'مشياً', en: 'Walking' },
  'meas.drive':      { ar: 'بالسيارة', en: 'Driving' },
  'meas.est':        { ar: 'تقديري', en: 'est.' },
  'meas.twoPts':     { ar: 'انقر نقطتين لقياس المسافة والزمن بينهما', en: 'Click two points for distance & time between them' },
  'meas.modeLine':   { ar: 'مسافة ومساحة', en: 'Distance & area' },
  'meas.modeRoute':  { ar: 'مسار السيارة', en: 'Driving route' },
  'meas.roadDist':   { ar: 'مسافة الطريق', en: 'Road distance' },
  'meas.roadTime':   { ar: 'زمن القيادة', en: 'Drive time' },
  'meas.routeHint':  { ar: 'انقر نقطة البداية ثم الوجهة — سيُرسم مسار الطريق الفعلي', en: 'Click start then destination — the real road path is drawn' },
  'meas.routeErr':   { ar: 'تعذّر جلب المسار، حاول مجدداً', en: 'Could not fetch the route, try again' },
  'af.title':        { ar: 'فلترة متقدمة', en: 'Advanced filters' },
  'af.area':         { ar: 'المساحة (م²)', en: 'Area (m²)' },
  'af.gfa':          { ar: 'GFA', en: 'GFA' },
  'af.far':          { ar: 'معامل البناء FAR', en: 'FAR' },
  'af.floors':       { ar: 'الأدوار', en: 'Floors' },
  'af.min':          { ar: 'من', en: 'Min' },
  'af.max':          { ar: 'إلى', en: 'Max' },
  'af.status':       { ar: 'الحالة', en: 'Status' },
  'af.reset':        { ar: 'إعادة تعيين', en: 'Reset' },
  'af.matches':      { ar: 'مطابقة', en: 'matches' },
  'report.scope':    { ar: 'نطاق التقرير', en: 'Report scope' },
  'report.developable': { ar: 'مساحة قابلة للتطوير', en: 'Developable area' },
  'report.avgFar':   { ar: 'متوسط معامل البناء', en: 'Avg. FAR' },
  'report.luMix':    { ar: 'مزيج الاستخدامات (حسب المساحة)', en: 'Land-use mix (by area)' },
  'merged.contains': { ar: 'تحتوي على', en: 'Contains' },
  'a.excel':         { ar: 'تصدير إكسل (كل الأراضي)', en: 'Export Excel (all plots)' },
  'sec.stage':       { ar: 'مرحلة الإنشاء', en: 'Construction stage' },
  'sec.license':     { ar: 'حالة التراخيص', en: 'Permits & licenses' },
  'perm.issued':     { ar: 'صادرة', en: 'Issued' },
  'perm.current':    { ar: 'قيد الإصدار', en: 'In process' },
  'perm.pending':    { ar: 'لم تُصدر', en: 'Pending' },
  'd.license':       { ar: 'آخر رخصة', en: 'Latest permit' },
  'opt.add':         { ar: 'إضافة خيار جديد', en: 'Add new option' },
  'opt.addTitle':    { ar: 'إضافة خيار جديد للقائمة', en: 'Add a new option to the list' },
  'opt.ar':          { ar: 'الاسم بالعربية', en: 'Arabic label' },
  'opt.en':          { ar: 'الاسم بالإنجليزية', en: 'English label' },
  'opt.color':       { ar: 'اللون على الخريطة', en: 'Map colour' },
  'merged.of':       { ar: 'مدموجة من', en: 'Merged from' },
  'd.unmerge':       { ar: 'إلغاء الدمج', en: 'Unmerge' },
  'd.unmergeConfirm':{ ar: 'سيتم فصل القطع المدموجة وإعادتها كما كانت قبل الدمج.', en: 'The merged unit will be split back into its original plots.' },
  'd.removeFromPlanConfirm': { ar: 'سيتم إزالة هذا البلوت من خطة التطوير.', en: 'This plot will be removed from the development plan.' },
  'd.copyLink':      { ar: 'نسخ رابط القطعة', en: 'Copy plot link' },
  'd.linkCopied':    { ar: 'تم نسخ الرابط', en: 'Link copied' },
  'sec.devplan':     { ar: 'خطة التطوير', en: 'Development plan' },
  'dp.tab':          { ar: 'خطة التطوير', en: 'Development' },
  'a.devplan':       { ar: 'خطة التطوير', en: 'Development' },
  'dp.start':        { ar: 'البداية', en: 'Start' },
  'dp.end':          { ar: 'النهاية', en: 'End' },
  'dp.phase':        { ar: 'المرحلة', en: 'Phase' },
  'dp.addPhase':     { ar: 'إضافة مرحلة', en: 'Add phase' },
  'dp.noPlan':       { ar: 'لا توجد خطة تطوير', en: 'No development plan' },
  'dp.onlyPlanned':  { ar: 'القطع التي لها خطة تطوير فقط', en: 'Only plots with a development plan' },
  'dp.timeline':     { ar: 'الجدول الزمني', en: 'Timeline' },
  'dp.phaseName':    { ar: 'اسم المرحلة', en: 'Phase name' },
  'tb.devplan':      { ar: 'خطة التطوير', en: 'Development Plan' },
  'tb.exec':         { ar: 'اللوحة التنفيذية', en: 'Executive dashboard' },
  'exec.title':      { ar: 'اللوحة التنفيذية للمخطط العام', en: 'Master-Plan Executive Dashboard' },
  'exec.developed':  { ar: 'نسبة الأراضي المطوّرة', en: 'Developed land' },
  'exec.underdev':   { ar: 'قيد التطوير', en: 'Under development' },
  'exec.portfolio':  { ar: 'إجمالي قيمة المحفظة', en: 'Portfolio value' },
  'exec.pipeline':   { ar: 'اهتمام المستثمرين', en: 'Investor pipeline' },
  'exec.leads':      { ar: 'مستثمر مهتم', en: 'investor leads' },
  'exec.print':      { ar: 'طباعة / حفظ PDF', en: 'Print / Save PDF' },
  'exec.plots':      { ar: 'إجمالي البلوت', en: 'Total plots' },
  'exec.avgFar':     { ar: 'متوسط معامل البناء', en: 'Avg. FAR' },
  'exec.byStatus':   { ar: 'توزيع حالة المشاريع', en: 'Project status mix' },
  'exec.pipelineChart': { ar: 'مسار المستثمرين', en: 'Investor funnel' },
  'exec.ref':        { ar: 'مرجع', en: 'Ref' },
  'exec.ofTotal':    { ar: 'من إجمالي المساحة', en: 'of total area' },
  'exec.named':      { ar: 'مشاريع مُسمّاة', en: 'Named projects' },
  'exec.permits':    { ar: 'تراخيص صادرة', en: 'Permits issued' },
  'exec.avgSize':    { ar: 'متوسط مساحة البلوت', en: 'Avg. plot size' },
  'exec.byOwnership':{ ar: 'حالة الملكية', en: 'Ownership status' },
  'exec.plotsBySector': { ar: 'عدد البلوت حسب القطاع', en: 'Plots by sector' },
  'exec.sectorTable':{ ar: 'ملخّص القطاعات', en: 'Sector summary' },
  'exec.devBySector':{ ar: 'نسبة التطوير حسب القطاع', en: 'Developed % by sector' },
  'exec.areaBySector':{ ar: 'المساحة حسب القطاع', en: 'Area by sector' },
  'exec.tSector':    { ar: 'القطاع', en: 'Sector' },
  'exec.tPlots':     { ar: 'البلوت', en: 'Plots' },
  'exec.tArea':      { ar: 'المساحة (م²)', en: 'Area (m²)' },
  'exec.tGfa':       { ar: 'GFA (م²)', en: 'GFA (m²)' },
  'exec.tDev':       { ar: 'مطوّر %', en: 'Developed %' },
  'exec.total':      { ar: 'الإجمالي', en: 'Total' },
  'tb.annotate':     { ar: 'الوسوم والتوضيحات', en: 'Labels' },
  'tb.export':       { ar: 'تصدير تقرير', en: 'Export report' },
  'report.title':    { ar: 'تقرير المخطط العام', en: 'Master Plan Report' },
  'report.generated':{ ar: 'أُنشئ في', en: 'Generated' },
  'report.print':    { ar: 'طباعة / حفظ PDF', en: 'Print / Save PDF' },
  'report.close':    { ar: 'إغلاق', en: 'Close' },
  'report.dl':       { ar: 'تنزيل الصورة', en: 'Download image' },
  'report.overview': { ar: 'ملخّص العرض الحالي', en: 'Current view summary' },
  'an.text':         { ar: 'وسم', en: 'Label' },
  'an.arrow':        { ar: 'سهم', en: 'Arrow' },
  'an.rect':         { ar: 'إطار', en: 'Frame' },
  'an.clear':        { ar: 'مسح الكل', en: 'Clear all' },
  'an.done':         { ar: 'تم', en: 'Done' },
  'an.hint':         { ar: 'وسم: انقر لإضافته ثم اكتب واسحبه لتحريكه · سهم/إطار: انقر نقطتين · مرّر على العنصر لحذفه', en: 'Label: click to add, type, drag to move · Arrow/Frame: click two points · hover an item to delete' },
  'dp.title':        { ar: 'خطة التطوير', en: 'Development Plan' },
  'dp.addPlot':      { ar: 'إضافة قطعة للخطة', en: 'Add plot to plan' },
  'dp.addHint':      { ar: 'أدخل رمز القطعة… مثل S19', en: 'Enter plot code… e.g. S19' },
  'dp.viewOnMap':    { ar: 'عرض على الخريطة', en: 'View on map' },
  'dp.notFound':     { ar: 'لم يتم العثور على القطعة', en: 'Plot not found' },
  'dp.count':        { ar: 'قطعة ضمن الخطة', en: 'plots in plan' },
  'd.addToPlan':     { ar: 'إضافة لخطة التطوير', en: 'Add to development plan' },
  'd.planUnlock':    { ar: 'أضِف هذا البلوت لخطة التطوير لفتح تفاصيل التطوير والمؤشرات الاستثمارية.', en: 'Add this plot to the development plan to unlock its development & investment details.' },
  'powered':         { ar: 'powered by : Sa^^3R', en: 'powered by : Sa^^3R' },
  'save.ok':         { ar: 'تم حفظ التعديل', en: 'Changes saved' },
  'save.err':        { ar: 'تعذّر الحفظ — جارٍ إعادة المحاولة', en: 'Save failed — retrying' },
  'm.addToPlan':     { ar: 'إضافة الكل لخطة التطوير', en: 'Add all to development plan' },
  'm.removeFromPlan':{ ar: 'إزالة الكل من خطة التطوير', en: 'Remove all from development plan' },
  'cp.hide':         { ar: 'إخفاء لوحة الفلاتر', en: 'Hide filters' },
  'cp.show':         { ar: 'إظهار لوحة الفلاتر', en: 'Show filters' },
};
export const t = (key: string, lang: Lang) => DICT[key]?.[lang] ?? key;

// ---------- Project types ----------
export interface ProjectType { key: string; ar: string; en: string; icon: string }
export const PROJECT_TYPES: Record<string, ProjectType> = {
  Hotel:        { key: 'Hotel',        ar: 'فندق',            en: 'Hotel',        icon: '🏨' },
  Hospital:     { key: 'Hospital',     ar: 'مستشفى',          en: 'Hospital',     icon: '🏥' },
  Mall:         { key: 'Mall',         ar: 'مركز تجاري',      en: 'Retail / Mall', icon: '🛍️' },
  Office:       { key: 'Office',       ar: 'مكاتب',           en: 'Offices',      icon: '🏢' },
  MixedUse:     { key: 'MixedUse',     ar: 'متعدد الاستخدامات', en: 'Mixed-Use',    icon: '🏙️' },
  Residential:  { key: 'Residential',  ar: 'سكني',            en: 'Residential',  icon: '🏘️' },
  Education:    { key: 'Education',     ar: 'تعليمي',          en: 'Education',     icon: '🎓' },
  Community:    { key: 'Community',     ar: 'مرافق مجتمعية',   en: 'Community',     icon: '🏛️' },
  Park:         { key: 'Park',         ar: 'مساحات مفتوحة',   en: 'Open Space',   icon: '🌳' },
  Cultural:     { key: 'Cultural',     ar: 'ثقافي',           en: 'Cultural',     icon: '🎭' },
  Utilities:    { key: 'Utilities',    ar: 'مرافق وبنية تحتية', en: 'Utilities',    icon: '⚙️' },
  Transit:      { key: 'Transit',      ar: 'نقل ومحطات',      en: 'Transit',      icon: '🚉' },
};

/** Infer a sensible default project type from the plot's land use. */
export function inferType(landUse: string | null | undefined): ProjectType {
  const l = (landUse ?? '').toLowerCase();
  if (l.includes('hospitality')) return PROJECT_TYPES.Hotel;
  if (l.includes('medical')) return PROJECT_TYPES.Hospital;
  if (l.includes('mixed')) return PROJECT_TYPES.MixedUse;
  if (l.includes('office')) return PROJECT_TYPES.Office;
  if (l.includes('commercial')) return PROJECT_TYPES.Mall;
  if (l.includes('education')) return PROJECT_TYPES.Education;
  if (l.includes('community')) return PROJECT_TYPES.Community;
  if (l.includes('open space')) return PROJECT_TYPES.Park;
  if (l.includes('cultural')) return PROJECT_TYPES.Cultural;
  if (l.includes('utilit')) return PROJECT_TYPES.Utilities;
  if (l.includes('train') || l.includes('station')) return PROJECT_TYPES.Transit;
  return PROJECT_TYPES.Residential;
}

// ---------- Expected electrical load (SEC / Saudi Building Code) ----------
// Planning-level electrical demand density by land use, in VA per m² of GFA.
// These are diversified demand densities consistent with the Saudi Electricity
// Company distribution planning code and the Saudi Building Code (SBC 401), used
// to size a plot's supply capacity in kVA:  kVA = GFA(m²) × density(VA/m²) ÷ 1000.
export const ELEC_DENSITY_VA_M2: Record<string, number> = {
  'Low/Med Density Residential': 30,
  'Medium Density Residential': 40,
  'High Density Residential & Commercial': 60,
  'Low/Med Density Residential & Commercial': 45,
  'Medium Density Residential & Commercial': 55,
  'High Density Mixed-Use': 80,
  'Medium Density Mixed-Use': 65,
  'Commercial': 90,
  'Cultural & Commercial': 85,
  'Offices': 70,
  'Hospitality': 90,
  'Medical': 120,
  'Education': 50,
  'Community Facilities': 50,
  'Open Space': 6,
  'Utilities': 40,
  'Train station and reservation': 80,
};
export const ELEC_DENSITY_DEFAULT = 60;

/** Demand density (VA/m²) for a land use; keyword match then a mixed-use default. */
export function elecDensity(landUse?: string | null): number {
  if (landUse && ELEC_DENSITY_VA_M2[landUse] != null) return ELEC_DENSITY_VA_M2[landUse];
  const l = (landUse ?? '').toLowerCase();
  if (l.includes('medical') || l.includes('hospital')) return 120;
  if (l.includes('hospitality') || l.includes('hotel')) return 90;
  if (l.includes('commercial') || l.includes('retail') || l.includes('mall')) return 90;
  if (l.includes('office')) return 70;
  if (l.includes('mixed')) return 80;
  if (l.includes('education')) return 50;
  if (l.includes('community')) return 50;
  if (l.includes('residential')) return 40;
  if (l.includes('open space') || l.includes('park')) return 6;
  if (l.includes('utilit')) return 40;
  if (l.includes('train') || l.includes('station')) return 80;
  return ELEC_DENSITY_DEFAULT;
}

/** Auto-estimated expected electrical load (kVA) from GFA + land use; null if no GFA. */
export function estimatedElecLoadKva(gfa?: number | null, landUse?: string | null): number | null {
  if (!gfa || gfa <= 0) return null;
  return Math.round((gfa * elecDensity(landUse)) / 1000 * 10) / 10;
}

// ---------- Status ----------
export interface StatusMeta { key: string; ar: string; en: string; color: string }
export const STATUS_META: Record<string, StatusMeta> = {
  Completed:         { key: 'Completed',         ar: 'مكتمل',       en: 'Completed',          color: '#2F6B3E' },
  UnderConstruction: { key: 'UnderConstruction', ar: 'تحت الإنشاء', en: 'Under construction', color: '#9A8A1E' },
  Future:            { key: 'Future',            ar: 'مستقبلي',     en: 'Future',             color: '#5C6B60' },
  Partner:           { key: 'Partner',           ar: 'مشروع شريك',  en: 'Partner',            color: '#7E6F1B' },
  OnHold:            { key: 'OnHold',            ar: 'متوقف مؤقتاً', en: 'On hold',            color: '#B5462F' },
};

/** Development-plan phase states (plan-appropriate; no "partner"). */
export const PHASE_STATUSES: { key: string; ar: string; en: string; color: string }[] = [
  { key: 'Future',            ar: 'مستقبلي',     en: 'Planned',     color: '#5C6B60' },
  { key: 'UnderConstruction', ar: 'قيد التنفيذ', en: 'In progress', color: '#9A8A1E' },
  { key: 'Completed',         ar: 'منتهي',       en: 'Completed',   color: '#2F6B3E' },
  { key: 'OnHold',            ar: 'متوقف مؤقتاً', en: 'On hold',     color: '#B5462F' },
];

export const STAGES = ['stage.foundation', 'stage.structure', 'stage.facade', 'stage.handover'] as const;

/** Construction-progress stages (ordered) shown as a bar on the plot card. */
export const PROGRESS_STAGES: { key: string; ar: string; en: string }[] = [
  { key: 'concrete', ar: 'الخرسانة', en: 'Concrete' },
  { key: 'construction', ar: 'الإنشاء', en: 'Construction' },
  { key: 'mep', ar: 'الميكانيكا والكهرباء', en: 'MEP' },
  { key: 'facade', ar: 'الواجهات', en: 'Façade' },
  { key: 'furniture', ar: 'التأثيث', en: 'Furnishing' },
  { key: 'completed', ar: 'مكتمل', en: 'Completed' },
];

// Regulatory permit pipeline, ordered per the Saudi development lifecycle
// (MISA investment → Baladiyah excavation/building → completion → Civil Defense → operating).
export const LICENSE_STAGES: { key: string; ar: string; en: string }[] = [
  { key: 'investment', ar: 'رخصة الاستثمار', en: 'Investment License' },
  { key: 'excavation', ar: 'رخصة الحفر', en: 'Excavation Permit' },
  { key: 'building', ar: 'رخصة البناء', en: 'Building Permit' },
  { key: 'completion', ar: 'رخصة إكمال البناء', en: 'Completion Certificate' },
  { key: 'civil_defense', ar: 'رخصة الدفاع المدني', en: 'Civil Defense (Safety)' },
  { key: 'operation', ar: 'رخصة التشغيل', en: 'Operating License' },
];

// ---------- Investor interest pipeline ----------
export interface InvestorStatus { key: string; ar: string; en: string; color: string }
export const INVESTOR_STATUSES: InvestorStatus[] = [
  { key: 'inquiry',     ar: 'استفسار', en: 'Inquiry',     color: '#5C6B60' },
  { key: 'negotiation', ar: 'تفاوض',   en: 'Negotiation', color: '#9A8A1E' },
  { key: 'reserved',    ar: 'محجوز',   en: 'Reserved',    color: '#2E7D6B' },
  { key: 'sold',        ar: 'مُباع',    en: 'Sold',        color: '#2F6B3E' },
  { key: 'declined',    ar: 'اعتذار',  en: 'Declined',    color: '#B5462F' },
];
export const investorStatusMeta = (k: string) => INVESTOR_STATUSES.find((s) => s.key === k) ?? INVESTOR_STATUSES[0];

// ---------- Ownership ----------
export interface OwnershipMeta { key: string; ar: string; en: string; color: string }
export const OWNERSHIP_META: Record<string, OwnershipMeta> = {
  available: { key: 'available', ar: 'متاح', en: 'Available', color: '#5C6B60' },
  reserved:  { key: 'reserved',  ar: 'محجوز', en: 'Reserved', color: '#9A8A1E' },
  owned:     { key: 'owned',     ar: 'مملوك', en: 'Owned',    color: '#2F6B3E' },
};

// ---------- Development plan ----------
/** Standard development phases the planner picks from (editable later). */
export const STANDARD_PHASES: { key: string; ar: string; en: string }[] = [
  { key: 'feasibility', ar: 'دراسة الجدوى', en: 'Feasibility Study' },
  { key: 'masterplan', ar: 'التخطيط العام', en: 'Master Planning' },
  { key: 'design', ar: 'التصميم', en: 'Design' },
  { key: 'permitting', ar: 'التراخيص', en: 'Permitting' },
  { key: 'siteprep', ar: 'تجهيز الموقع', en: 'Site Preparation' },
  { key: 'foundation', ar: 'الأساسات', en: 'Foundation' },
  { key: 'structure', ar: 'الهيكل الإنشائي', en: 'Structure' },
  { key: 'mep', ar: 'الأعمال الكهروميكانيكية', en: 'MEP Works' },
  { key: 'facade', ar: 'الواجهات', en: 'Façade' },
  { key: 'finishing', ar: 'التشطيبات', en: 'Finishing' },
  { key: 'landscape', ar: 'التنسيق والمناظر', en: 'Landscaping' },
  { key: 'handover', ar: 'التسليم', en: 'Handover' },
  { key: 'operation', ar: 'التشغيل', en: 'Operation' },
];

export interface Phase {
  name_ar?: string; name_en?: string;
  start?: string;   // ISO date
  end?: string;     // ISO date
  status?: string;  // STATUS_META key
}

// ---------- Investment highlights ----------
/** Financial / investment KPIs shown on the plot card and edited in the editor. */
export interface InvestmentInfo {
  totalValue?: number;   // Total value of the project (SAR)
  devCost?: number;      // Total development cost (SAR)
  npv?: number;          // Net present value (SAR)
  tenure?: number;       // Project tenure (years)
  gsa?: number;          // Gross saleable area (sqm)
  units?: number;        // Number of units
  hotelRooms?: number;   // No. of hotel rooms
  projectIRR?: number;   // Project IRR (%)
  equityIRR?: number;    // Equity IRR (%)
  roi?: number;          // Return on investment (%)
  moic?: number;         // Multiple on invested capital (x)
  capRate?: number;      // Capitalisation rate / yield (%)
  payback?: number;      // Payback period (years)
}

type InvUnit = 'sar' | 'sqm' | 'num' | 'pct' | 'yr' | 'x';
export interface InvestField { key: keyof InvestmentInfo; ar: string; en: string; unit: InvUnit }
/** Ordered list of investment KPIs (scale → returns → physical). */
export const INVEST_FIELDS: InvestField[] = [
  { key: 'totalValue', ar: 'إجمالي قيمة المشروع', en: 'Total project value', unit: 'sar' },
  { key: 'devCost',    ar: 'إجمالي تكلفة التطوير', en: 'Total development cost', unit: 'sar' },
  { key: 'npv',        ar: 'صافي القيمة الحالية NPV', en: 'NPV', unit: 'sar' },
  { key: 'projectIRR', ar: 'العائد الداخلي للمشروع IRR', en: 'Project IRR', unit: 'pct' },
  { key: 'equityIRR',  ar: 'العائد الداخلي للملكية', en: 'Equity IRR', unit: 'pct' },
  { key: 'roi',        ar: 'العائد على الاستثمار ROI', en: 'ROI', unit: 'pct' },
  { key: 'moic',       ar: 'مضاعف رأس المال MOIC', en: 'MOIC', unit: 'x' },
  { key: 'capRate',    ar: 'معدل الرسملة Cap Rate', en: 'Cap rate / yield', unit: 'pct' },
  { key: 'payback',    ar: 'فترة الاسترداد', en: 'Payback period', unit: 'yr' },
  { key: 'tenure',     ar: 'مدة المشروع', en: 'Project tenure', unit: 'yr' },
  { key: 'gsa',        ar: 'المساحة القابلة للبيع', en: 'Gross saleable area', unit: 'sqm' },
  { key: 'units',      ar: 'عدد الوحدات', en: 'Number of units', unit: 'num' },
  { key: 'hotelRooms', ar: 'عدد الغرف الفندقية', en: 'Hotel rooms', unit: 'num' },
];

const nfInv = new Intl.NumberFormat('en-US');
/** Format an investment value with full thousands separators + a unit suffix. */
export function fmtInvest(v: number, unit: InvUnit, lang: Lang): string {
  const sar = lang === 'ar' ? 'ر.س' : 'SAR';
  switch (unit) {
    case 'sar': return `${nfInv.format(Math.round(v))} ${sar}`;
    case 'sqm': return `${nfInv.format(Math.round(v))} ${lang === 'ar' ? 'م²' : 'm²'}`;
    case 'num': return nfInv.format(Math.round(v));
    case 'pct': return `${nfInv.format(+v.toFixed(2))}%`;
    case 'yr': return `${nfInv.format(+v.toFixed(1))} ${lang === 'ar' ? 'سنة' : 'yrs'}`;
    case 'x': return `${nfInv.format(+v.toFixed(2))}×`;
    default: return nfInv.format(v);
  }
}

// ---------- Project overlay (per-plot, editable via admin; Firebase-ready) ----------
export interface ProjectInfo {
  name_ar?: string; name_en?: string;
  type?: string;       // PROJECT_TYPES key (overrides inference)
  status?: string;     // STATUS_META key
  progress?: number;   // 0..100
  gallery?: string[];  // image URLs (optional)
  summary_ar?: string; summary_en?: string;
  ownership?: string;  // OWNERSHIP_META key: available | reserved | owned
  owner?: string;      // investor / owner name
  purchase_date?: string;
  phases?: Phase[];    // development-plan timeline
  devplan_ar?: string; devplan_en?: string;  // development-plan narrative
  investment?: InvestmentInfo;               // investment highlights
  stage?: string;      // PROGRESS_STAGES key (current construction stage)
  license?: string;    // LICENSE_STAGES key (latest permit obtained)
}

export function useProjects() {
  const [map, setMap] = useState<Record<string, ProjectInfo>>({});
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'projects.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => setMap(j || {}))
      .catch(() => setMap({}));
  }, []);
  return map;
}

/** Resolve a plot's project view: overlay first, then inference from land use. */
export function resolveProject(
  code: string, landUse: string | null, overlay: Record<string, ProjectInfo>,
) {
  const o = overlay[code] ?? {};
  const type = PROJECT_TYPES[o.type ?? ''] ?? inferType(landUse);
  const status = STATUS_META[o.status ?? ''] ?? STATUS_META.Future;
  const named = Boolean(o.name_ar || o.name_en);
  const progress = typeof o.progress === 'number' ? o.progress : status.key === 'Completed' ? 100 : status.key === 'UnderConstruction' ? 55 : 0;
  const ownership = OWNERSHIP_META[o.ownership ?? ''] ?? (o.owner ? OWNERSHIP_META.owned : OWNERSHIP_META.available);
  return { overlay: o, type, status, named, progress, ownership, owner: o.owner ?? null };
}
