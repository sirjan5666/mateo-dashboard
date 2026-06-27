import { useSyncExternalStore } from 'react';

/**
 * Light/dark mode for the professional panels (Admin / Doctor / Patient).
 * Backed by a tiny module-level store so the shell (which writes the
 * `data-mode` attribute) and the toggle button (which may live in a different
 * part of the tree, e.g. the Topbar) stay in sync without prop-drilling.
 * Persisted in localStorage; first run honours the OS colour-scheme.
 */
export type PanelMode = 'light' | 'dark';

const KEY = 'mateo:panelMode';

function read(): PanelMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

let current: PanelMode = read();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setPanelMode(next: PanelMode) {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  emit();
}

export function togglePanelMode() {
  setPanelMode(current === 'dark' ? 'light' : 'dark');
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): PanelMode {
  return current;
}

/** Subscribe a component to the current panel mode. */
export function usePanelMode(): PanelMode {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
