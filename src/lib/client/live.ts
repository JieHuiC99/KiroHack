"use client";
import { useEffect, useState } from "react";
import type { LiveState } from "@/lib/validation/emergency";

const POLL_MS = 1500;

/** Polls /api/state. `undefined` until the first answer arrives. */
export function useLiveState() {
  const [state, setState] = useState<LiveState>();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as LiveState;
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
  }, []);

  return { state, offline };
}

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
