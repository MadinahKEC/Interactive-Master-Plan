<div dir="rtl">

# نقل المشروع والعمل عليه على كمبيوتر آخر

مشروعك محفوظ بالكامل على **GitHub**، فالنقل ليس نسخ ملفات يدوياً، بل: **استنساخ → تثبيت → تشغيل**.
يعمل مباشرة بعد الاستنساخ — إعدادات Firebase مكتوبة داخل الكود، ولا تحتاج أي ملفات سرّية.

---

## أين أكتب الأوامر؟

على الجهاز الجديد استخدم **PowerShell** (موجود في ويندوز افتراضياً) — افتح قائمة ابدأ واكتب `PowerShell`.
> لا تستخدم Claude Code في البداية، لأن المشروع لم يوجد على الجهاز بعد. بعد استنساخه وفتحه في المحرّر يمكنك استخدام الـTerminal المدمج.

---

## الخطوات

### 1) ثبّت برنامجين (مرة واحدة فقط)
- **Git** — من https://git-scm.com
- **Node.js** (اختر نسخة LTS) — من https://nodejs.org

بعد التثبيت، تأكد أنهما يعملان (أغلق PowerShell وافتحه من جديد أولاً):
```powershell
git --version
node -v
```

### 2) استنسخ المشروع من GitHub
اختر مكاناً (مثلاً سطح المكتب) ثم:
```powershell
cd $HOME\Desktop
git clone https://github.com/MadinahKEC/Interactive-Master-Plan.git
```

### 3) ادخل المجلد وثبّت الحزم
```powershell
cd Interactive-Master-Plan
npm install
```

### 4) شغّل المشروع
```powershell
npm run dev --workspace @kec/web
```
افتح المتصفح على: **http://localhost:5173** — نفس ما تعمل عليه الآن تماماً. ✅
(لإيقاف التشغيل: اضغط `Ctrl + C` في PowerShell.)

---

## المزامنة بين الأجهزة (مهم)

GitHub هو «المستودع المركزي». حافظ على التزامن دائماً:

**قبل أن تترك أي جهاز** — ارفع تعديلاتك:
```powershell
git add -A
git commit -m "وصف مختصر للتعديل"
git push
```

**قبل أن تبدأ العمل على أي جهاز** — نزّل آخر التحديثات:
```powershell
git pull
```

**للرفع من جهاز جديد أول مرة** — عرّف Git بهويتك (مرة واحدة)، وسيطلب تسجيل الدخول على GitHub تلقائياً عند أول `git push`:
```powershell
git config --global user.name "Samer Hamdan"
git config --global user.email "metalic8er@gmail.com"
```

---

## ملاحظات

- **البيانات** (البلوتات، الأسماء، التعديلات) محفوظة على **Firebase** وتظهر تلقائياً في أي جهاز — لا تحتاج نقلها.
- **الكود فقط** هو ما يُنقل عبر GitHub.
- القاعدة الذهبية: `git pull` قبل البدء، و`git push` بعد الانتهاء — فلا تضيع أي تعديل ولا يحدث تعارض.

</div>
