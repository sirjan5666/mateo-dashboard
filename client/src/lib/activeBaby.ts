import { useEffect, useState } from 'react';

// The single source of truth for "which baby is the parent currently focused on".
//
// Persisted in localStorage so the choice survives reloads, and REACTIVE so that
// selecting a baby on the Dashboard immediately re-points the Sidebar's tracker
// links — the two live in separate component trees, and localStorage on its own
// does not notify same-tab listeners. Without this, the Sidebar fell back to the
// newest baby, so "Growth"/"Milestones" always opened the most-recently-added
// baby regardless of which one you had selected.
//
// Same storage key the app has always used, so any read-on-mount consumers
// (AssistantLauncher, Community) keep working unchanged.
const KEY = 'mateo:activeBaby';

type Listener = (id: string | null) => void;
const listeners = new Set<Listener>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // private mode / storage disabled
  }
}

/** Current active baby id (or null). Non-reactive — for one-off reads. */
export function getActiveBabyId(): string | null {
  return read();
}

/** Remember the chosen baby and notify every reactive reader in this tab. */
export function rememberActiveBaby(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore — the choice just won't persist across reloads */
  }
  for (const l of listeners) l(id);
}

/** Forget the active baby (e.g. the selected baby was deleted). */
export function forgetActiveBaby(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  for (const l of listeners) l(null);
}

/**
 * Reactive read of the active baby id. Re-renders when any component in this tab
 * calls rememberActiveBaby/forgetActiveBaby, or when another tab changes it.
 */
export function useActiveBabyId(): string | null {
  const [id, setId] = useState<string | null>(() => read());
  useEffect(() => {
    listeners.add(setId);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setId(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(setId);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return id;
}
