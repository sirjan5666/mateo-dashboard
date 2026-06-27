/**
 * Dark mode was removed from the professional panels (Admin / Doctor / Patient) —
 * they are light-only now. These exports are kept as light-only stubs so existing
 * consumers (the chart theme, the shells, the overlays) keep working unchanged;
 * `usePanelMode()` always reports 'light', and the setters are no-ops.
 */
export type PanelMode = 'light' | 'dark';

export function setPanelMode() {
  /* no-op — panels are light-only */
}

export function togglePanelMode() {
  /* no-op — panels are light-only */
}

export function usePanelMode(): PanelMode {
  return 'light';
}
