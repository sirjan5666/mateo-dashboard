import { useSyncExternalStore } from 'react';

/**
 * Open/closed state for the doctor command palette (⌘K / Ctrl-K). Module-level
 * store (same pattern as panelTheme/density) so the global keyboard shortcut,
 * the top-bar search button and the palette itself all stay in sync.
 */
let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function openCommand() {
  if (open) return;
  open = true;
  emit();
}

export function closeCommand() {
  if (!open) return;
  open = false;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): boolean {
  return open;
}

export function useCommandOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
