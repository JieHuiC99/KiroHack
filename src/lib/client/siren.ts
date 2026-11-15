"use client";

// A two-tone evacuation siren made with the Web Audio API: nothing to download, so it works on a bad network.
//
// Browsers only let a page make sound after someone has clicked it. The classroom startup agent opens the
// browser with autoplay allowed, so there the siren starts on its own; in an ordinary tab `start()` returns
// false until the page has been clicked once, and the screen asks for that click.

type Siren = { context: AudioContext; oscillator: OscillatorNode; sweep: ReturnType<typeof setInterval> };
let current: Siren | null = null;

const LOW_HZ = 620;
const HIGH_HZ = 1180;
const SWEEP_SECONDS = 0.6;

/** Starts the siren if it isn't sounding. Returns whether it can actually be heard. */
export function startSiren(): boolean {
  if (typeof window === "undefined" || !("AudioContext" in window)) return false;
  if (!current) {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sawtooth";
    gain.gain.value = 0.5;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    const wail = () => {
      const now = context.currentTime;
      oscillator.frequency.cancelScheduledValues(now);
      oscillator.frequency.setValueAtTime(LOW_HZ, now);
      oscillator.frequency.linearRampToValueAtTime(HIGH_HZ, now + SWEEP_SECONDS);
      oscillator.frequency.linearRampToValueAtTime(LOW_HZ, now + SWEEP_SECONDS * 2);
    };
    wail();
    current = { context, oscillator, sweep: setInterval(wail, SWEEP_SECONDS * 2000) };
  }
  if (current.context.state === "suspended") void current.context.resume();
  return current.context.state === "running";
}

export function stopSiren() {
  if (!current) return;
  clearInterval(current.sweep);
  current.oscillator.stop();
  void current.context.close();
  current = null;
}
