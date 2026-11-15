"use client";
import type { RouteStep } from "@/lib/floor/types";

// Vibration only works in Android browsers; iPhone Safari ignores it (see README "Known limits").
export const VIBRATION: Record<RouteStep["cue"] | "alarm" | "update", number[]> = {
  alarm: [600, 200, 600, 200, 600],
  update: [150, 100, 150],
  start: [300],
  straight: [120],
  left: [250], // one buzz = left
  right: [250, 150, 250], // two buzzes = right
  back: [250, 150, 250, 150, 250],
  arrive: [700],
};

export function vibrate(pattern: number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
}

/**
 * The app's own voice. Screen-reader users should switch it off in setup: TalkBack/VoiceOver
 * already read the aria-live regions, and two voices talking at once is worse than one.
 * Browsers only allow speech after the user has tapped the page at least once.
 */
export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}
