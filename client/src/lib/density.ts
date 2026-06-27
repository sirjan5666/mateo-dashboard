import { useSyncExternalStore } from 'react';

/**
 * Comfortable / Compact information density for the professional panels,
 * persisted per doctor. Same module-level store pattern as `panelTheme` so any
 * component (a table cell, the toggle in the header) can read density without
 * prop-drilling and stay in sync. Default is comfortable.
 */
export type Density = 'comfortable' | 'compact';

const KEY = 'mateo:density';

function read(): Density {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'comfortable' || v === 'compact') return v;
  } catch {
    /* ignore */
  }
  return 'comfortable';
}

let current: Density = read();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setDensity(next: Density) {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  emit();
}

export function toggleDensity() {
  setDensity(current === 'compact' ? 'comfortable' : 'compact');
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): Density {
  return current;
}

/** Subscribe a component to the current panel density. */
export function useDensity(): Density {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
