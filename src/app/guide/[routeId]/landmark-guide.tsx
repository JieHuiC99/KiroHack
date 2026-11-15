"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { TURN_DEGREES, TURN_TEXT } from "@/components/ar-guide";
import { ArView, type ArGuidance } from "@/components/ar-view";
import { BUTTON, EndDot, MAP_SIZE, Notice, SCREEN, ScreenHeader, ScreenTitle, StartDot, StepCard, Summary } from "@/components/sunsafe-screen";
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
    <main className={SCREEN}>
      <ScreenHeader pill={`Checkpoint ${index + 1} of ${checkpoints.length}`} tone="info" home="/me" />

      <section className="flex flex-col gap-2">
        <ScreenTitle title={`To ${route.to}`} subtitle={`From ${route.from}. Scan the QR code beside each landmark, or press the button when you reach it.`} />
        <ArView
          className={`${MAP_SIZE} rounded-[28px]`}
          intro="Point the camera at the QR code beside each landmark. An arrow on the floor shows the way."
          withoutCompass="arrow shows the turn, standing facing the landmark"
          guide={guide}
          onScan={(text, heading) => {
            const target = checkpointFromScan(route, text);
            if (target >= 0) arriveAt(target, heading);
          }}
          action={(heading) => (turn !== null && facing === null ? { label: `Facing "${here.title}"? Press to lock the arrow`, run: () => setFacing(heading) } : null)}
        />
      </section>

      <StepCard live label={`${here.level} · ${here.title}`} text={here.instruction} turn={turn ?? undefined} />

      {next ? (
        <figure className="flex items-center gap-3 rounded-2xl bg-[#eef7f4] p-2">
          <Image src={next.image} alt="" width={640} height={850} unoptimized loading="eager" className="h-28 w-24 shrink-0 rounded-xl object-cover" />
          <figcaption className="text-[15px]">
            <span className="block font-bold">Next, look for: {next.title}</span>
            <span className="block text-[#4f6970]">{next.look} Scan the QR code beside it.</span>
          </figcaption>
        </figure>
      ) : null}

      <div aria-live="polite">
        {error || checkedIn ? <Notice tone={error ? "danger" : "info"}>{error || "You are marked safe. Stay in the Green zone until the all clear."}</Notice> : null}
      </div>

      <div className="flex flex-col gap-2">
        {next ? (
          <button type="button" onClick={() => arriveAt(index + 1, null)} className={`${BUTTON.base} ${BUTTON.primary} min-h-[12dvh] text-2xl`}>
            I&apos;ve reached: {next.title}
          </button>
        ) : (
          <button type="button" onClick={checkIn} disabled={checkedIn} className={`${BUTTON.base} ${BUTTON.primary} min-h-[12dvh] text-2xl`}>
            I am safe at the Green zone
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => arriveAt(index - 1, null)} disabled={index === 0} className={`${BUTTON.base} ${BUTTON.quiet} text-lg`}>
            Back one
          </button>
          <button type="button" onClick={() => speak(here.instruction)} className={`${BUTTON.base} ${BUTTON.quiet} text-lg`}>
            Repeat
          </button>
        </div>
      </div>

      <Summary
        rows={[
          [<><StartDot />From</>, route.from],
          [<><EndDot />To</>, route.to.replace(/^the /, "The ")],
          ["Checkpoints", `${checkpoints.length}, each with a QR code`],
        ]}
      />
    </main>
  );
}
