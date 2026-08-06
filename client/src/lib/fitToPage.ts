/** A4 at 96 CSS px per inch — the box a printed sheet has to fit inside. */
const A4_WIDTH_PX = Math.round((210 / 25.4) * 96); // 794
const A4_HEIGHT_PX = Math.round((297 / 25.4) * 96); // 1123

/**
 * Scale a printable sheet so it always comes out on ONE page.
 *
 * The sheet cannot simply be measured on screen: the print stylesheet is
 * narrower and much tighter than the app layout, so an on-screen height would
 * be the wrong number. Instead the print geometry is applied for a moment
 * (`.rx-print-geometry`, authored in index.css precisely so it can be reused
 * here), the sheet is measured inside an A4-width box, and the resulting factor
 * is handed to the stylesheet as `--rx-print-scale`.
 *
 * Returns the factor. 1 means it already fitted and nothing was shrunk — the
 * common case, so an ordinary prescription is never scaled for no reason.
 */
export function fitSheetToOnePage(elementId = 'rx-sheet'): number {
  const el = document.getElementById(elementId);
  if (!el) return 1;

  const root = document.documentElement;
  // A fixed A4-wide box, so the measurement is of the printed layout rather
  // than of whatever width the browser window happens to be.
  const shim = document.createElement('style');
  shim.textContent = `html.rx-print-geometry, html.rx-print-geometry body { width: ${A4_WIDTH_PX}px !important; }`;

  root.classList.add('rx-print-geometry');
  document.head.appendChild(shim);
  el.style.removeProperty('--rx-print-scale');
  // Read after the class lands so the browser has reflowed to print geometry.
  const height = el.getBoundingClientRect().height;
  document.head.removeChild(shim);
  root.classList.remove('rx-print-geometry');

  if (!height) return 1;
  // Never scale UP a short prescription — a two-line sheet blown up to fill A4
  // would look like a mistake.
  const scale = Math.min(1, A4_HEIGHT_PX / height);
  el.style.setProperty('--rx-print-scale', String(scale));
  return scale;
}

/**
 * Keeps the scale correct for print triggered from the browser's own menu or
 * Ctrl+P, not just the page's buttons. Returns a cleanup function.
 */
export function watchPrint(onMeasure: (scale: number) => void, elementId = 'rx-sheet') {
  const handler = () => onMeasure(fitSheetToOnePage(elementId));
  window.addEventListener('beforeprint', handler);
  return () => window.removeEventListener('beforeprint', handler);
}
