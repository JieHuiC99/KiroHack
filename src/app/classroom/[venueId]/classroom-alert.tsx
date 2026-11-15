"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BUTTON, EndDot, MapHint, MAP_SIZE, Notice, RouteMap3D, SCREEN, ScreenHeader, ScreenTitle, StartDot, Summary } from "@/components/sunsafe-screen";
import { speak } from "@/lib/client/announce";
import { findEvacuationRoute, level3 } from "@/lib/floor/building";
import { post, usePolled } from "@/lib/client/live";
import { startSiren, stopSiren } from "@/lib/client/siren";
import { useStored } from "@/lib/client/stored";
import type { VenueState } from "@/lib/validation/venues";
import type { Venue } from "@/lib/venues";

const SPEAK_EVERY_MS = 9000;

/**
 * The screen on the classroom computer. Quiet until the emergency team triggers the alarm; then a
 * full-screen prompt and a siren that only stop when someone presses the one button. If the team
 * still sees people on CCTV and repeats the siren, the prompt comes back.
 */
export function ClassroomAlert({ venue }: { venue: Venue }) {
  // This computer's proof that it is a classroom PC. It arrives once in the address (#key=…, put there by
  // the startup agent or typed below) and is then kept on this computer.
  const { value: deviceKey, save: saveKey, ready } = useStored<string>("safeway.device-key");
  useEffect(() => {
    const fromAddress = new URLSearchParams(window.location.hash.slice(1)).get("key");
    if (!fromAddress) return;
    saveKey(fromAddress);
    window.history.replaceState(null, "", window.location.pathname); // don't leave the key in the address bar
  }, [saveKey]);
  const { state, offline, denied } = usePolled<VenueState>(deviceKey ? `/api/venues/${venue.id}` : null, deviceKey ?? undefined);
  const [audible, setAudible] = useState(false);
  const [error, setError] = useState("");
  const [shownFloorId, setShownFloorId] = useState(level3.id);
  // Only Level 3 rooms are mapped so far; other venues get the written message without a map.
  const route = findEvacuationRoute(level3.id, venue.id);

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
    const result = await post(`/api/venues/${venue.id}`, { action: "acknowledge" }, deviceKey ?? undefined);
    setError(result.error ?? "");
  }

  const map = route ? (
    <>
      <RouteMap3D
        route={route.path}
        startFloorId={level3.id}
        startRoomId={venue.id}
        shownFloorId={shownFloorId}
        onShowFloor={setShownFloorId}
        hereLabel="This classroom"
        className={MAP_SIZE}
      />
      <MapHint />
    </>
  ) : null;
  const details: [React.ReactNode, React.ReactNode][] = [
    ["Class", session ? `${session.code} · ${session.lecturer} · ${session.students} students` : "No class timetabled now"],
    ...(route
      ? ([
          [<><StartDot />From</>, `${venue.name}, ${venue.level}`],
          [<><EndDot />Exit</>, route.stairName],
        ] as [React.ReactNode, React.ReactNode][])
      : []),
    ["Assembly", assemblyPoint.replace(/^the /, "The ")],
  ];

  if (!ready) return null;
  if (!deviceKey || denied) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 p-4 text-lg sm:p-6 sm:text-xl">
        <h1 className="text-3xl font-bold">{venue.name}: register this computer</h1>
        <p role="status" className="rounded-xl border-2 border-black p-4 font-semibold">
          {denied ? "That device key was not accepted." : "This computer is not registered for classroom alerts yet."} Ask the disaster recovery team for the classroom
          device key.
        </p>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const key = String(new FormData(event.currentTarget).get("key") ?? "").trim();
            if (key) saveKey(key);
          }}
        >
          <label className="flex flex-col gap-2 font-semibold">
            Classroom device key
            <input name="key" type="password" required autoComplete="off" className="rounded-lg border-2 border-black p-4 font-normal" />
          </label>
          <button type="submit" className="min-h-16 rounded-xl bg-black p-4 text-2xl font-bold text-white">
            Register
          </button>
        </form>
      </main>
    );
  }

  if (prompting) {
    return (
      // Any click on the screen is enough for the browser to allow the siren, if it hasn't started by itself.
      <main role="alertdialog" aria-labelledby="alarm-title" aria-describedby="alarm-text" onPointerDown={() => setAudible(startSiren())} className="min-h-dvh bg-white">
        <p aria-hidden="true" className="animate-[alarm-flash_1s_steps(1)_infinite] bg-[#b91c1c] py-2 text-center text-lg font-black tracking-widest text-white">
          FIRE ALARM
        </p>
        <div className={SCREEN}>
          <ScreenHeader pill={`Fire alarm · ${venue.name}`} tone="alarm" home="/classroom" />
          <section className="flex flex-col gap-2">
            <ScreenTitle id="alarm-title" title={repeated ? `Leave ${venue.name} now` : `Evacuate ${venue.name} now`} subtitle={<span id="alarm-text">{message}</span>} />
            {map}
          </section>
          <button type="button" autoFocus onClick={acknowledge} className={`${BUTTON.base} ${BUTTON.danger} min-h-20 text-2xl`}>
            I&apos;ll evacuate right now
          </button>
          <p role="status" className="text-center text-sm font-semibold text-[#4f6970]">
            {error || (audible ? "The siren stops when you press the button." : "Click anywhere to turn the siren on.")}
          </p>
          <Summary rows={details} />
        </div>
      </main>
    );
  }

  const status = offline ? "Offline" : !state ? "Connecting…" : alarm && alert ? (alert.cleared ? "Room cleared" : "Evacuating") : "On watch";
  return (
    <main className={SCREEN}>
      <ScreenHeader
        pill={status}
        tone={alarm && alert && !alert.cleared ? "alarm" : offline ? "info" : "calm"}
        home="/classroom"
        right={
          <Link href="/classroom" className="text-sm font-semibold text-[#4f6970] underline">
            Change room
          </Link>
        }
      />
      <section className="flex flex-col gap-2">
        <ScreenTitle
          title={alarm && alert && !alert.cleared ? `Evacuate ${venue.name}` : venue.name}
          subtitle={
            alarm && alert
              ? alert.cleared
                ? "The emergency team has confirmed this room is empty."
                : `Acknowledged. Leave the room now and go to ${assemblyPoint}. Use the emergency staircase, not the lifts.`
              : "Keep this page open. If the fire alarm goes off, an alert with a siren appears here until someone presses the button."
          }
        />
        {map}
      </section>
      <p role="status" className="sr-only">
        {alarm && alert
          ? alert.cleared
            ? "The emergency team has confirmed this room is empty."
            : `Acknowledged. Leave the room now and go to ${assemblyPoint}.`
          : offline
            ? "No connection. Reconnecting…"
            : !state
              ? "Connecting…"
              : "No emergency right now. This screen is on watch."}
      </p>
      {offline ? <Notice>No connection. Reconnecting…</Notice> : null}
      <Summary rows={details} />
      {session ? (
        <p className="px-1 text-[15px] text-[#4f6970]">
          Class in this room now: {session.code} {session.title}, {session.startsAt} to {session.endsAt}.
        </p>
      ) : null}
      <button
        type="button"
        className={`${BUTTON.base} ${BUTTON.dark} text-lg`}
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
