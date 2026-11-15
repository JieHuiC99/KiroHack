"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";

const CHANGED = "safeway:stored";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/**
 * A JSON value kept in localStorage, so a phone remembers who it belongs to across reloads
 * and without a network. `ready` is false during server render / hydration.
 */
export function useStored<T>(key: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key),
    () => undefined,
  );

  const value = useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }, [raw]);

  const save = useCallback(
    (next: T | null) => {
      if (next === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGED));
    },
    [key],
  );

  return { value, save, ready: raw !== undefined };
}
