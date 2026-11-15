"use client";
import { useEffect, useState } from "react";
import type { LiveState } from "@/lib/validation/emergency";

const POLL_MS = 1500;

/**
 * Polls a JSON endpoint. `state` is `undefined` until the first answer arrives.
 * `denied` is true when the server refuses (signed out, wrong role, wrong device key).
 * Pass `key` to send the classroom device key; pass `null` as the url to wait.
 */
export function usePolled<T>(url: string | null, key?: string) {
  const [state, setState] = useState<T>();
  const [offline, setOffline] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!url) return;
    let stopped = false;
    async function poll() {
      try {
        const res = await fetch(url!, { cache: "no-store", headers: key ? { [DEVICE_KEY_HEADER]: key } : undefined });
        if (res.status === 401 || res.status === 403) {
          if (!stopped) setDenied(true);
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as T;
        if (!stopped) {
          setState(next);
          setOffline(false);
          setDenied(false);
        }
      } catch {
        if (!stopped) setOffline(true);
      }
    }
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [url, key]);

  return { state, offline, denied };
}

/** What the phone, responder and dashboard screens poll. */
export const useLiveState = () => usePolled<LiveState>("/api/state");

/** Must match DEVICE_KEY_HEADER in src/lib/session.ts (that file is server-only). */
const DEVICE_KEY_HEADER = "x-safeway-device-key";

export async function post(path: string, body: unknown, key?: string): Promise<{ error?: string }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { [DEVICE_KEY_HEADER]: key } : {}) },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? {} : { error: json.error ?? "Something went wrong. Try again." };
  } catch {
    return { error: "No connection. Try again." };
  }
}

/** Seconds since an ISO timestamp, measured on the server's clock so phones with wrong clocks agree. */
export function secondsSince(iso: string, serverTime: string) {
  return Math.max(0, Math.round((new Date(serverTime).getTime() - new Date(iso).getTime()) / 1000));
}
