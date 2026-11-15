"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TURN_DEGREES, TURN_TEXT } from "@/components/ar-guide";
import { ArView, type ArGuidance } from "@/components/ar-view";
import { speak, vibrate, VIBRATION } from "@/lib/client/announce";
import { post } from "@/lib/client/live";
import { useStored } from "@/lib/client/stored";
import { relativeAngle, turnFor } from "@/lib/floor/bearing";
import { checkpointFromScan, type LandmarkRoute } from "@/lib/landmark-routes";
import type { AppUser } from "@/lib/roles";

/**
 * Camera guide along a route of landmarks. Where the person is comes from the QR code on the wall at each
 * landmark (or the "I've reached" button); nothing about it is stored. Scanning means they are facing the
 * landmark, so that moment's compass reading tells the arrow which way "turn right from here" really is.
 */
export function LandmarkGuide({ route, user, startAt }: { route: LandmarkRoute; user: AppUser; startAt: number }) {
  const [index, setIndex] = useState(startAt);
  // Compass heading while facing the current landmark. Null until a scan or the "lock" button gives one.
  const [facing, setFacing] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [checkedIn, setCheckedIn] = useState(false);
  const { value: savedVoice } = useStored<boolean>("safeway.voice");
  const voice = savedVoice ?? user.profile === "blind";

  const checkpoints = route.checkpoints;
  const here = checkpoints[index];
  const next = checkpoints[index + 1];
  const turn = here.go === "down" || here.go === "arrive" ? null : here.go;

  useEffect(() => {
    if (voice) speak(here.instruction);
  }, [here.instruction, voice]);

  function arriveAt(target: number, heading: number | null) {
    if (target === index && heading === null) return;
    vibrate(checkpoints[target].go === "arrive" ? VIBRATION.arrive : VIBRATION.update);
    setIndex(target);
    setFacing(heading);
    setError("");
  }

  function guide(heading: number | null): ArGuidance {
    if (here.go === "arrive") return { offset: null, symbol: "arrived", caption: "You have arrived" };
    if (turn === null) return { offset: null, symbol: "down", caption: "Take the stairs down", detail: next ? `to ${next.title}` : undefined };
    // With a compass and a locked direction the arrow stays put as the phone turns; otherwise it shows the turn itself.
    const offset = heading !== null && facing !== null ? relativeAngle(facing + TURN_DEGREES[turn], heading) : TURN_DEGREES[turn];
    return { offset, caption: TURN_TEXT[turnFor(offset)], detail: next ? `to ${next.title}` : undefined };
  }

  async function checkIn() {
    const result = await post("/api/checkin", {});
    setError(result.error === "There is no active emergency" ? "No alarm is active, so there is nothing to check in to. In a real alarm this marks you safe." : (result.error ?? ""));
    setCheckedIn(!result.error);
  }

  return (
    <main className="flex min-h-dvh flex-col bg-black text-white md:grid md:h-dvh md:grid-cols-[3fr_2fr] md:grid-rows-[auto_minmax(0,1fr)]">
      <h1 className="p-3 text-center text-lg font-extrabold tracking-wide text-yellow-300 sm:text-xl md:col-span-2">
        {route.from.toUpperCase()} → {route.to.toUpperCase()}
      </h1>

      <ArView
        className="h-[42dvh] min-h-64 w-full md:h-full"
        intro="Point the camera at the QR code beside each landmark. An arrow on the floor shows the way."
        withoutCompass="arrow shows the turn, standing facing the landmark"
        guide={guide}
        onScan={(text, heading) => {
          const target = checkpointFromScan(route, text);
          if (target >= 0) arriveAt(target, heading);
        }}
        action={(heading) => (turn !== null && facing === null ? { label: `Facing "${here.title}"? Press to lock the arrow`, run: () => setFacing(heading) } : null)}
      />

      <div className="flex flex-1 flex-col gap-3 p-3 md:overflow-y-auto">
        <section aria-live="assertive" aria-atomic="true" className="rounded-2xl border-2 border-white p-3 sm:p-4">
          <p className="text-base font-semibold text-yellow-300 sm:text-lg">
            Checkpoint {index + 1} of {checkpoints.length} · {here.level} · {here.title}
          </p>
          <p className="text-xl leading-snug font-bold sm:text-2xl">{here.instruction}</p>
        </section>

        {next ? (
          <figure className="flex items-center gap-3 rounded-2xl bg-white p-2 text-black">
            <Image src={next.image} alt="" width={640} height={850} unoptimized loading="eager" className="h-28 w-24 shrink-0 rounded-lg object-cover" />
            <figcaption>
              <span className="block text-base font-bold">Next, look for: {next.title}</span>
              <span className="block text-base">{next.look} Scan the QR code beside it.</span>
            </figcaption>
          </figure>
        ) : null}

        <p aria-live="polite" className={error || checkedIn ? "rounded-2xl bg-white p-3 text-lg font-bold text-black" : "sr-only"}>
          {error || (checkedIn ? "You are marked safe. Stay in the Green zone until the all clear." : "")}
        </p>

        {next ? (
          <button type="button" onClick={() => arriveAt(index + 1, null)} className="min-h-[12dvh] flex-1 rounded-2xl bg-yellow-300 p-4 text-2xl font-extrabold text-black sm:text-3xl">
            I&apos;ve reached: {next.title}
          </button>
        ) : (
          <button type="button" onClick={checkIn} disabled={checkedIn} className="min-h-[12dvh] flex-1 rounded-2xl bg-yellow-300 p-4 text-2xl font-extrabold text-black disabled:opacity-50 sm:text-3xl">
            I am safe at the Green zone
          </button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => arriveAt(index - 1, null)} disabled={index === 0} className="min-h-14 rounded-2xl border-2 border-white p-3 text-lg font-extrabold disabled:opacity-40">
            Back one
          </button>
          <button type="button" onClick={() => speak(here.instruction)} className="min-h-14 rounded-2xl bg-white p-3 text-lg font-extrabold text-black">
            Repeat
          </button>
        </div>
        <Link href="/me" className="self-center underline">
          Back to my evacuation screen
        </Link>
      </div>
    </main>
  );
}
