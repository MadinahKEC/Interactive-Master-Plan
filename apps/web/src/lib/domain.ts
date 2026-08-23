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
  'a.audit':         { ar: 'سجل التدقيق', en: 'Audit Log' },
  'a.settings':      { ar: 'الإعدادات', en: 'Settings' },
  'a.search':        { ar: 'بحث…', en: 'Search…' },
  'a.save':          { ar: 'حفظ', en: 'Save' },
  'a.cancel':        { ar: 'إلغاء', en: 'Cancel' },
  'a.projectInfo':   { ar: 'بيانات المشروع', en: 'Project info' },
  'a.plotAttrs':     { ar: 'سمات البلوت', en: 'Plot attributes' },
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
  'a.export':        { ar: 'تصدير البيانات', en: 'Export data' },
  'a.import':        { ar: 'استيراد البيانات', en: 'Import data' },
  'a.reset':         { ar: 'إعادة تعيين', en: 'Reset' },
  'a.resetConfirm':  { ar: 'حذف كل التعديلات المحلية؟', en: 'Delete all local edits?' },
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
  'sec.project':     { ar: 'المشروع', en: 'Project' },
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
  'm.aggregate':     { ar: 'التجميع', en: 'Aggregate' },
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
  'sub.undo':        { ar: 'إلغاء التقسيم', en: 'Undo subdivision' },
  'sub.targetArea':  { ar: 'المساحة المستهدفة (م²)', en: 'Target area (m²)' },
  'sub.parts':       { ar: 'القطع', en: 'Parts' },
  'sub.hint':        { ar: 'تُقسَّم الأرض بأشكال متناسبة مع المساحات المدخلة، والبيانات تُحسب حسب شكل كل قطعة.', en: 'The plot is split into shapes proportional to the entered areas; data is scaled to each piece.' },
  'sub.already':     { ar: 'هذه الأرض مقسّمة حالياً', en: 'This plot is currently subdivided' },
  'sub.needParts':   { ar: 'أضف قطعتين على الأقل', en: 'Add at least two parts' },
  'merged.of':       { ar: 'مدموجة من', en: 'Merged from' },
  'd.unmerge':       { ar: 'إلغاء الدمج', en: 'Unmerge' },
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
  'powered':         { ar: 'powered by : Sa^^3R', en: 'powered by : Sa^^3R' },
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

// ---------- Status ----------
export interface StatusMeta { key: string; ar: string; en: string; color: string }
export const STATUS_META: Record<string, StatusMeta> = {
  Completed:         { key: 'Completed',         ar: 'مكتمل',       en: 'Completed',          color: '#2F6B3E' },
  UnderConstruction: { key: 'UnderConstruction', ar: 'تحت الإنشاء', en: 'Under construction', color: '#9A8A1E' },
  Future:            { key: 'Future',            ar: 'مستقبلي',     en: 'Future',             color: '#5C6B60' },
  Partner:           { key: 'Partner',           ar: 'مشروع شريك',  en: 'Partner',            color: '#7E6F1B' },
};

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
  stage?: string;      // PROGRESS_STAGES key (current construction stage)
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
