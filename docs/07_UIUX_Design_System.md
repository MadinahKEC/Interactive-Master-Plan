# 07 · UI/UX & Design System — نظام التصميم والهوية

Arabic-first · RTL · **light theme only** · premium, minimal, information-dense.

## 7.1 Brand tokens (KEC identity)
```css
:root{
  /* greens */
  --kec-green:#2F6B3E; --kec-title:#1C6034; --kec-green-deep:#143D1E; --kec-green-mid:#3E8E4F;
  /* golds */
  --kec-gold:#9A8A1E; --kec-olive:#7E6F1B;
  /* neutrals */
  --kec-ink:#16221B; --kec-muted:#5C6B60;
  --kec-paper:#FBFCFA; --kec-surface:#F0F5EC; --kec-surface-2:#EAF3E4; --kec-hairline:#E4EBDF;
  /* semantic */
  --kec-pos:#2F6B3E; --kec-neg:#B5462F; --kec-info:#2E7D6B; --kec-warn:#9A8A1E;
  /* type */
  --kec-font:'Readex Pro',system-ui,'Segoe UI',Tahoma,sans-serif;
  --kec-mono:'IBM Plex Mono',ui-monospace,monospace;
  /* elevation */
  --shadow:0 6px 22px rgba(20,61,30,.10),0 1px 3px rgba(20,61,30,.08);
  --shadow-lg:0 18px 50px rgba(20,61,30,.18);
  --radius:12px; --radius-lg:16px;
}
```
Semantics of colour (consistent everywhere): **green = good/ours**, **gold = attention**,
**red = bad**, **grey = neutral**. Never colour by category for state — only by state.
Land-use colours are a **separate categorical palette** used only on the map legend.

## 7.2 Typography
- Family **Readex Pro** (excellent Arabic + Latin), **IBM Plex Mono** for codes/coordinates/metrics.
- Scale: hero 46 · title 29.6 · sub 16.8 · kpi 25 · h 14.4 · body 12 · label 10 · small 9.5.
- Numerals rendered LTR inside RTL via `unicode-bidi:isolate`.

## 7.3 RTL rules
- `dir="rtl"` at root; use logical CSS properties (`margin-inline`, `inset-inline`).
- Primary controls sit on the **right**; the detail/inspector panel slides from the **left**.
- Icons that imply direction (back, next) mirror; the map itself never mirrors.
- Charts (ECharts) configured RTL; axes and legends right-aligned.

## 7.4 Land-use categorical palette (map legend)
Residential sands `#F2D8A7 / #E9C583` · Res+Commercial ambers `#E39A54 / #EDC58C / #E3B36B`
· Mixed-Use oranges `#D97E4E / #E0A277` · Commercial `#C85C4E` · Cultural&Commercial
`#B5588F` · Offices `#8A6D4F` · Hospitality `#9C6BB0` · Medical `#D06B84` · Education
`#5B8FB0` · Community `#4FA5A0` · Open Space `#88BF6A` · Utilities `#9AA0A6` · Train
station `#6D7B8A`. Editable in the admin option list.

## 7.5 Layout system
- 8-px spacing grid; `--gap:9px` base for dense panels.
- App shell: 60-px top bar (brand · basemap toggle · 2D/3D · view actions) · floating
  glass panels over a full-bleed map · right control rail · left inspector.
- Panels: `--radius-lg`, `--shadow`, translucent `--kec-paper` with backdrop blur.
- Responsive: desktop-first; panels collapse to sheets on tablet; map stays full-bleed.

## 7.6 Component inventory (see `17` component library)
Top bar/brand · segmented toggle · search field (mono) · filter chips · KPI card ·
legend row · plot detail panel · attribute cell · primary/secondary button · pill/tag ·
modal · tabbed form · table (sticky first column, sortable) · toast · empty state ·
loading ring · map controls (nav, scale, measure, draw) · dashboard chart card.

## 7.7 Map UI patterns
- **Hover:** subtle fill-opacity lift + tooltip (code + land use).
- **Select:** gold outline (`--kec-gold`), inspector opens with all attributes.
- **Basemap toggle:** light ⇄ satellite; outline/label colours auto-adjust for contrast.
- **3D toggle:** extrude by height; ease pitch to ~55°.
- **Legend = filter:** click a land use to toggle it; sector chips filter; KPIs recompute live.
- **Empty/へ states:** when a filter yields nothing, show a friendly RTL empty state.

## 7.8 Motion
- 150–250 ms ease for panels/toggles; 600–800 ms camera flights. Respect
  `prefers-reduced-motion`.

## 7.9 Accessibility (WCAG 2.1 AA)
- Contrast ≥ 4.5:1 for text; focus-visible rings on every control; full keyboard nav;
  ARIA roles/labels on toggles, search, legend, panels; hit targets ≥ 32 px.

## 7.10 Voice & tone (copy)
Section names, field labels and KPI labels are **nouns/noun-phrases** — no verbs, no
sentences. Arabic first, concise, professional. Codes stay Latin/mono (`S19`).
