import { useSyncExternalStore } from 'react';
import type { Tone } from '../components/ui/tones';

/**
 * Imperative toast store for optimistic UI in the pro panels. Call `toast(...)`
 * from anywhere (event handlers, api callbacks) — no provider/context needed;
 * a single <Toaster/> mounted in the shell renders the stack. Module-level store
 * mirrors `panelTheme`/`density`. IDs come from a counter (no Date.now in render).
 */
export interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
  /** ms before auto-dismiss; <= 0 keeps it until dismissed. */
  duration: number;
}

let seq = 0;
let items: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function toast(message: string, opts?: { tone?: Tone; duration?: number }): number {
  const id = (seq += 1);
  items = [...items, { id, message, tone: opts?.tone ?? 'stone', duration: opts?.duration ?? 4000 }];
  emit();
  return id;
}

export function dismissToast(id: number) {
  const next = items.filter((t) => t.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ToastItem[] {
  return items;
}

/** Subscribe a component (the Toaster) to the live toast list. */
export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
