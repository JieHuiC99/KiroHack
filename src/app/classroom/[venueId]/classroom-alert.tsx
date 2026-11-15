"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { speak } from "@/lib/client/announce";
import { post, usePolled } from "@/lib/client/live";
import { startSiren, stopSiren } from "@/lib/client/siren";
import type { VenueState } from "@/lib/validation/venues";
import type { Venue } from "@/lib/venues";

const SPEAK_EVERY_MS = 9000;

/**
 * The screen on the classroom computer. Quiet until the emergency team triggers the alarm; then a
 * full-screen prompt and a siren that only stop when someone presses the one button. If the team
 * still sees people on CCTV and repeats the siren, the prompt comes back.
 */
export function ClassroomAlert({ venue }: { venue: Venue }) {
  const { state, offline } = usePolled<VenueState>(`/api/venues/${venue.id}`);
  const [audible, setAudible] = useState(false);
  const [error, setError] = useState("");

  const alarm = state?.emergency ?? null;
  const alert = state?.venue.alert ?? null;
  const prompting = alarm !== null && alert !== null && !alert.acknowledged;
  const session = state?.venue.session ?? null;
  const assemblyPoint = alarm?.assemblyPoint ?? "the assembly point";
  const repeated = (alert?.sirenRound ?? 1) > 1;
  const message = repeated
    ? `The emergency team can still see people in ${venue.name}. Leave now and go to ${assemblyPoint}.`
    : `Fire alarm. Everyone in ${venue.name} must leave now and go to ${assemblyPoint}. Use the emergency staircase. Do not use the lifts.`;

  // Siren and voice for as long as the prompt is up. `audible` stays false until the browser allows sound.
  useEffect(() => {
    if (!prompting) return;
    const sound = () => {
      const ok = startSiren();
      setAudible(ok);
      return ok;
    };
    // Deferred so the first try happens after this render, like every later one.
    const first = setTimeout(() => {
      if (sound()) speak(message);
    }, 0);
    const retry = setInterval(sound, 1000);
    const voice = setInterval(() => speak(message), SPEAK_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(retry);
      clearInterval(voice);
      stopSiren();
      window.speechSynthesis?.cancel();
    };
  }, [prompting, message]);

  async function acknowledge() {
    const result = await post(`/api/venues/${venue.id}`, { action: "acknowledge" });
    setError(result.error ?? "");
  }

  if (prompting) {
    return (
      // Any click on the screen is enough for the browser to allow the siren, if it hasn't started by itself.
      <main
        role="alertdialog"
        aria-labelledby="alarm-title"
        aria-describedby="alarm-text"
        onPointerDown={() => setAudible(startSiren())}
        className="fixed inset-0 z-50 flex animate-[alarm-flash_1s_steps(1)_infinite] flex-col items-center justify-center gap-6 bg-red-700 p-6 text-center text-white sm:gap-8"
      >
        <h1 id="alarm-title" className="text-5xl font-black tracking-wide sm:text-7xl">
          FIRE ALARM
        </h1>
        <p id="alarm-text" className="max-w-4xl text-2xl leading-snug font-bold sm:text-4xl">
          {message}
        </p>
        {session ? (
          <p className="text-xl sm:text-2xl">
            {session.lecturer}: take {session.code} ({session.students} students) with you.
          </p>
        ) : null}
        <button
          type="button"
          autoFocus
          onClick={acknowledge}
          className="min-h-24 w-full max-w-3xl rounded-2xl border-4 border-white bg-yellow-300 p-5 text-2xl font-black text-black sm:text-4xl"
        >
          I&apos;ll evacuate right now to {assemblyPoint}
        </button>
        <p role="status" className="text-lg font-semibold sm:text-xl">
          {error || (audible ? "The siren stops when you press the button." : "Click anywhere to turn the siren on.")}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 p-4 text-lg sm:p-6 sm:text-xl">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{venue.name}</h1>
        <Link href="/classroom" className="underline">
          Change room
        </Link>
      </header>

      {alarm && alert ? (
        <p role="status" className="rounded-xl bg-red-800 p-5 text-2xl font-bold text-white">
          {alert.cleared
            ? "The emergency team has confirmed this room is empty."
            : `Acknowledged. Leave the room now and go to ${assemblyPoint}. Use the emergency staircase, not the lifts.`}
        </p>
      ) : (
        <p role="status" className="rounded-xl border-2 border-black p-4 text-xl font-semibold sm:text-2xl">
          {offline ? "No connection. Reconnecting…" : !state ? "Connecting…" : "No emergency right now. This screen is on watch."}
        </p>
      )}

      <p>
        {session
          ? `Class in this room now: ${session.code} ${session.title}, ${session.lecturer}, ${session.startsAt} to ${session.endsAt}.`
          : "No class is timetabled in this room right now."}
      </p>
      <p>Keep this page open. If the fire alarm is triggered, a full-screen alert with a siren appears here and stays until someone presses the button.</p>
      <button
        type="button"
        className="min-h-16 rounded-xl bg-black p-4 text-xl font-bold text-white"
        onClick={() => {
          // This click also lets the browser play the siren later without asking again.
          startSiren();
          setTimeout(stopSiren, 1500);
        }}
      >
        Test the siren
      </button>
    </main>
  );
}
