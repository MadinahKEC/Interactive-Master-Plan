/**
 * Print one report with a guaranteed page setup. Chrome does not reliably honour
 * per-element named-page orientation, so we inject a single global `@page` rule
 * (orientation + margin) right before printing and remove it afterwards. This makes
 * every export come out at the intended orientation and at 100% scale with no manual
 * changes in the print dialog.
 */
export function printWithPage(rule: string, title?: string) {
  const id = 'kec-print-page';
  document.getElementById(id)?.remove();
  const el = document.createElement('style');
  el.id = id;
  el.media = 'print';
  el.textContent = `@page{${rule}}`;
  document.head.appendChild(el);

  const prevTitle = document.title;
  if (title) document.title = title;

  const cleanup = () => {
    el.remove();
    document.title = prevTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 1500); // fallback if afterprint never fires
}
