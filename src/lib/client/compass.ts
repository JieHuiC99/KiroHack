"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { compassHeading, smoothHeading } from "@/lib/floor/bearing";

type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type PermissionApi = { requestPermission?: () => Promise<"granted" | "denied"> };

export type CompassStatus = "off" | "on" | "denied" | "unavailable";

const NO_READING_MS = 2500;

/**
 * Which way the phone's back camera is facing, in degrees clockwise from north, or null until known.
 * `start()` must be called from a tap: iPhones only hand out the compass after asking the person.
 */
export function useCompass() {
  const [heading, setHeading] = useState<number | null>(null);
  const [status, setStatus] = useState<CompassStatus>("off");
  const last = useRef<number | null>(null);
  const stop = useRef<() => void>(() => {});

  const start = useCallback(async () => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return setStatus("unavailable");
    const api = window.DeviceOrientationEvent as unknown as PermissionApi;
    if (api.requestPermission) {
      const answer = await api.requestPermission().catch(() => "denied" as const);
      if (answer !== "granted") return setStatus("denied");
    }

    const onReading = (event: Event) => {
      const reading = event as CompassEvent;
      let next: number | null = null;
      if (typeof reading.webkitCompassHeading === "number") next = reading.webkitCompassHeading; // iPhone: already a compass heading
      else if (reading.absolute && reading.alpha !== null && reading.beta !== null && reading.gamma !== null) {
        next = compassHeading(reading.alpha, reading.beta, reading.gamma);
      }
      if (next === null) return;
      last.current = smoothHeading(last.current, next);
      setHeading(last.current);
      setStatus("on");
    };
    // Android reports true-north readings on the "absolute" event; iPhone on the ordinary one.
    window.addEventListener("deviceorientationabsolute", onReading);
    window.addEventListener("deviceorientation", onReading);
    // Laptops have the API but no sensor: nothing ever arrives.
    const giveUp = setTimeout(() => {
      if (last.current === null) setStatus("unavailable");
    }, NO_READING_MS);
    stop.current = () => {
      clearTimeout(giveUp);
      window.removeEventListener("deviceorientationabsolute", onReading);
      window.removeEventListener("deviceorientation", onReading);
    };
  }, []);

  useEffect(() => () => stop.current(), []);

  return { heading, status, start };
}
