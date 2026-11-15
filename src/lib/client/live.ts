"use client";
import { useEffect, useState } from "react";
import type { LiveState } from "@/lib/validation/emergency";

const POLL_MS = 1500;

/**
 * Polls a JSON endpoint. `state` is `undefined` until the first answer arrives.
 * Pass `null` as the url to wait. No account or device credentials are required.
 */
export function usePolled<T>(url: string | null) {
  const [state, setState] = useState<T>();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!url) return;
    let stopped = false;
    async function poll() {
      try {
        const res = await fetch(url!, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as T;
        if (!stopped) {
          setState(next);
          setOffline(false);
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
  }, [url]);

  return { state, offline };
}

/** What the phone, responder and dashboard screens poll. */
export const useLiveState = () => usePolled<LiveState>("/api/state");

export async function post(path: string, body: unknown): Promise<{ error?: string }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
