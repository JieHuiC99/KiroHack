"use client";
import { useEffect, useState } from "react";
import type { AppUser } from "@/lib/roles";

/**
 * The signed-in person as the server sees them (role included), for the header's account menu and nav.
 * `undefined` while loading, `null` when signed out. Asked once per page: no cache, so signing in or
 * out on another screen is never shown stale.
 */
export function useAccount() {
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);
  useEffect(() => {
    let stopped = false;
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<AppUser>) : null))
      .catch(() => null)
      .then((next) => {
        if (!stopped) setUser(next);
      });
    return () => {
      stopped = true;
    };
  }, []);
  return user;
}

/** "Aisha Rahman" → "AR", "ben" → "B". */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0]?.[0] ?? "?")).toUpperCase();
}
