"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArGuide } from "@/components/ar-guide";
import { FloorMap3D } from "@/components/floor-map-3d";
import { speak, vibrate, VIBRATION } from "@/lib/client/announce";
import { post, useLiveState } from "@/lib/client/live";
import { findEvacuationRoute, getFloor, ground, level3 } from "@/lib/floor/building";
import { mapBearing } from "@/lib/floor/bearing";
import { pathLength, remainingPath, theStair } from "@/lib/floor/routing";
import type { Turn } from "@/lib/floor/types";
import type { AppUser } from "@/lib/roles";
import type { LiveState, Profile } from "@/lib/validation/emergency";
import { LocationForm, type Place } from "./setup-form";

type Emergency = NonNullable<LiveState["emergency"]>;
type HelpRequest = LiveState["requests"][number];

/** Who is holding the phone (from their account) and where they said they are (this visit only). */
type Settings = { id: string; name: string; profile: Profile; roomId: string; voice: boolean };

export function StudentApp({ user }: { user: AppUser }) {
  const { state, offline } = useLiveState();
  // Asked on every visit and kept in memory only: never in the phone's storage, never in the account.
  const [place, setPlace] = useState<Place | null>(null);

  // Earlier versions remembered the room on the phone. Forget it.
  useEffect(() => window.localStorage.removeItem("safeway.settings"), []);

  if (!place) return <LocationForm floor={level3} user={user} alarm={Boolean(state?.emergency)} onSave={setPlace} />;

  const settings: Settings = { id: user.id, name: user.name, profile: user.profile, ...place };
  if (state?.emergency) {
    return <EmergencyScreen key={state.emergency.id} settings={settings} state={state} emergency={state.emergency} offline={offline} />;
  }
  return <Standby settings={settings} offline={offline} loading={!state} onMove={() => setPlace(null)} />;
}

/** The map is the main view for everyone who can see it; blind users get the audio-first layout. */
const usesMap = (settings: Settings) => settings.profile !== "blind";

function Standby({ settings, offline, loading, onMove }: { settings: Settings; offline: boolean; loading: boolean; onMove: () => void }) {
  const room = level3.rooms.find((r) => r.id === settings.roomId);
  const route = findEvacuationRoute(level3.id, settings.roomId, { needsAssistance: settings.profile === "wheelchair" });
  const goesOutside = route?.path.some((p) => p.floorId === ground.id) ?? false;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 p-4 text-lg sm:gap-6 sm:p-6 sm:text-xl">
      <h1 className="text-3xl font-bold">SafeWay</h1>
      <p role="status" className="rounded-xl border-2 border-black p-4 text-xl font-semibold sm:text-2xl">
        {offline ? "No connection. Reconnecting…" : loading ? "Connecting…" : "No emergency right now."}
      </p>

      {usesMap(settings) && route ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">Your way out</h2>
          <FloorMap3D
            floor={level3}
            route={route.path}
            position={route.path[0]}
            focus={route.path}
            highlightRoomId={settings.roomId}
            className="h-[45dvh] min-h-72 w-full overflow-hidden rounded-xl border-2 border-black"
          />
          <p>
            From {room?.name}, {level3.label}: about {route.metres} metres to <strong>{theStair(route.stairName)}</strong>
            {route.exitKind === "bombaLift"
              ? `, where a helper takes you down in the Bomba lift and out to ${ground.assemblyPoint}`
              : goesOutside
                ? `, down ${level3.level} floors by the emergency staircase, then out to ${ground.assemblyPoint}`
                : ", where a helper meets you on the landing"}
            . Never use the ordinary lifts in a fire. Drag to rotate,
            pinch to zoom, and use the floor buttons to look at each level.
          </p>
        </section>
      ) : (
        <p>
          {settings.name}, you are set up in {room?.name ?? "an unknown room"}, {level3.label}.
          {route ? ` Your way out is ${theStair(route.stairName)}, about ${route.metres} metres away.` : ""}
        </p>
      )}

      <p>Keep this page open: if an alarm starts, directions appear here.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="min-h-16 rounded-xl bg-black p-4 text-xl font-bold text-white"
          onClick={() => {
            vibrate(VIBRATION.update);
            speak("Voice is working. You will hear evacuation instructions like this.");
          }}
        >
          Test voice and vibration
        </button>
        <button type="button" className="min-h-16 rounded-xl border-2 border-black p-4 text-xl font-bold" onClick={onMove}>
          I have moved: change my room
        </button>
      </div>
      <Link href="/" className="self-start underline">
        Account and sign out
      </Link>
    </main>
  );
}

const ARROW_DEGREES: Record<Turn, number> = { straight: 0, right: 90, back: 180, left: -90 };

/** Big arrow next to the written step. Decorative: the text already says the direction. */
function TurnArrow({ turn }: { turn: Turn }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-14 shrink-0 text-yellow-300 sm:size-16"
      style={{ transform: `rotate(${ARROW_DEGREES[turn]}deg)` }}
    >
      <path d="M12 2 20 11h-5v11H9V11H4z" fill="currentColor" />
    </svg>
  );
}

function helpStatusText(request: HelpRequest | undefined) {
  if (!request) return "";
  if (request.status === "resolved") return "Your helper has marked you as safely evacuated.";
  if (request.status === "accepted") return `${request.responderName} has accepted and is coming to you. Stay where you are.`;
  if (request.escalationLevel === 2) return "Your request has been sent to the emergency response team. Help is being arranged.";
  if (request.escalationLevel === 1) return "Still looking. Your request has now been sent to all helpers.";
  return "Help requested. Looking for a helper.";
}

const BIG = "min-h-[14dvh] flex-1 rounded-2xl p-4 text-3xl font-extrabold";
const SMALL = "min-h-16 rounded-2xl p-3 text-xl font-extrabold";

function EmergencyScreen({ settings, state, emergency, offline }: { settings: Settings; state: LiveState; emergency: Emergency; offline: boolean }) {
  const floor = getFloor(emergency.floorId) ?? level3;
  const myRequest = state.requests.findLast((r) => r.personId === settings.id);
  const isSafe = state.safeIds.includes(settings.id);
  const needsAssistance = settings.profile === "wheelchair" || (myRequest !== undefined && myRequest.status !== "resolved");
  const route = findEvacuationRoute(floor.id, settings.roomId, { blockedStairIds: emergency.blockedStairIds, needsAssistance });
  const showMap = usesMap(settings);

  // Progress belongs to one route. If a staircase gets blocked the route changes and we start again.
  const routeKey = `${route?.stairId}:${needsAssistance}`;
  const [progress, setProgress] = useState({ routeKey, index: -1 });
  const index = progress.routeKey === routeKey ? progress.index : -1;
  const [error, setError] = useState("");
  const [view, setView] = useState<"map" | "camera">("map");

  const rerouted = emergency.blockedStairIds.length > 0;
  const start = showMap ? "Follow the arrows on the map" : "Press Next step to begin";
  const intro = !route
    ? "Fire emergency. Every staircase on this floor is reported blocked. Stay where you are, keep low, and press I need help."
    : settings.profile === "wheelchair"
      ? route.exitKind === "bombaLift"
        ? `Fire emergency on ${floor.label}. Do not use the ordinary lifts. Press I need help, then follow the arrows to ${theStair(route.stairName)} and wait there for your helper.`
        : `Fire emergency on ${floor.label}. Do not use the lift. Press I need help, then follow the arrows to the landing of ${theStair(route.stairName)}.`
      : `Fire emergency on ${floor.label}. Do not use the lift. ${rerouted ? `A staircase is blocked. ` : ""}${start} to ${theStair(route.stairName)}, about ${route.metres} metres.`;

  const step = route && index >= 0 ? route.steps[index] : undefined;
  const instruction = isSafe ? "You are marked safe. Stay at the assembly point until the all clear." : (step?.text ?? intro);
  const helpStatus = helpStatusText(myRequest);
  const atLastStep = route !== null && index === route.steps.length - 1;
  const helpIsOpen = myRequest !== undefined && myRequest.status !== "resolved";
  const position = route ? (step?.at ?? route.path[0]) : undefined;
  // Arrows only for the way still to go: the trail behind the current checkpoint is dropped.
  const remaining = route && position ? remainingPath(route.path, position) : [];
  const waitingHere = step?.wait === true;
  // For the camera view: the leg being walked now, if there is one on this floor.
  const legFloor = getFloor(position?.floorId ?? floor.id) ?? floor;
  const leg = remaining.filter((p) => p.floorId === legFloor.id).slice(0, 2);
  const legBearing = leg.length === 2 ? mapBearing(leg[0], leg[1]) : null;
  const legMetres = leg.length === 2 ? Math.max(1, Math.round(pathLength(leg) * legFloor.metresPerUnit)) : null;
  const goingDown = remaining.some((p) => p.floorId !== legFloor.id);
  // The map shows one floor at a time: the floor the current step is on.
  const shownFloor = getFloor(position?.floorId ?? floor.id) ?? floor;
  const nextFloorId = route && index + 1 < route.steps.length ? route.steps[index + 1].at?.floorId : undefined;
  const nextFloor = nextFloorId && nextFloorId !== shownFloor.id ? getFloor(nextFloorId) : undefined;

  // The alarm itself: one long vibration when this screen first appears.
  useEffect(() => vibrate(VIBRATION.alarm), []);

  // Screen readers announce the aria-live regions below; this is the app's own voice for everyone else.
  useEffect(() => {
    if (settings.voice) speak(instruction);
  }, [instruction, settings.voice]);

  useEffect(() => {
    if (!helpStatus) return;
    vibrate(VIBRATION.update);
    if (settings.voice) speak(helpStatus);
  }, [helpStatus, settings.voice]);

  function repeat() {
    vibrate(step ? VIBRATION[step.cue] : VIBRATION.update);
    // Repeat always speaks, even with the voice setting off: tapping it is asking to hear it.
    speak(helpStatus ? `${instruction} ${helpStatus}` : instruction);
  }

  async function next() {
    if (!route) return;
    if (atLastStep) {
      const result = await post("/api/checkin", {});
      setError(result.error ?? "");
      return;
    }
    const nextIndex = index + 1;
    vibrate(VIBRATION[route.steps[nextIndex].cue]);
    setProgress({ routeKey, index: nextIndex });
  }

  async function askForHelp() {
    if (helpIsOpen) return repeat();
    const result = await post("/api/help", { roomId: settings.roomId });
    setError(result.error ?? "");
  }

  const nextLabel = !route
    ? "No route available"
    : atLastStep
      ? waitingHere
        ? "Wait here for your helper"
        : "I am safe at the assembly point"
      : index === -1
        ? "Start: next step"
        : waitingHere
          ? "My helper is here: continue"
          : nextFloor
          ? `Continue to ${nextFloor.label}`
          : "Next step";

  // Which button is the big one depends on who is holding the phone.
  const primary: "next" | "help" = settings.profile === "wheelchair" ? "help" : "next";
  const size = (name: "next" | "help" | "repeat") => (!showMap || name === primary ? BIG : SMALL);

  const helpButton = (
    <button key="help" type="button" onClick={askForHelp} className={`${size("help")} border-4 border-white bg-red-800 text-white`}>
      {helpIsOpen ? "Help requested — hear status" : "I need help"}
    </button>
  );
  const nextButton = (
    <button
      key="next"
      type="button"
      onClick={next}
      disabled={!route || isSafe || (atLastStep && waitingHere)}
      className={`${size("next")} bg-yellow-300 text-black disabled:opacity-50`}
    >
      {nextLabel}
    </button>
  );
  const repeatButton = (
    <button key="repeat" type="button" onClick={repeat} className={`${size("repeat")} bg-white text-black`}>
      Repeat
    </button>
  );

  return (
    <main className="flex min-h-dvh flex-col bg-black text-white md:grid md:h-dvh md:grid-cols-[3fr_2fr] md:grid-rows-[auto_minmax(0,1fr)]">
      <h1 className="p-3 text-center text-xl font-extrabold tracking-wide text-yellow-300 sm:text-2xl md:col-span-2">
        FIRE EMERGENCY — {floor.label.toUpperCase()}
      </h1>

      {showMap && route && view === "camera" ? (
        <ArGuide
          bearing={legBearing}
          metres={legMetres}
          towards={legFloor.id === ground.id ? "the assembly point" : route.stairName}
          goingDown={goingDown}
          fallbackTurn={step?.arrow}
          className="h-[42dvh] min-h-64 w-full md:h-full"
        />
      ) : showMap && route ? (
        <FloorMap3D
          floor={floor}
          route={remaining}
          position={position}
          focus={remaining}
          showFloorId={shownFloor.id}
          returnKey={index}
          alarm
          blockedStairIds={emergency.blockedStairIds}
          highlightRoomId={settings.roomId}
          className="h-[42dvh] min-h-64 w-full md:h-full"
        />
      ) : null}

      <div className={`flex flex-1 flex-col gap-3 p-3 md:overflow-y-auto ${showMap && route ? "" : "md:col-span-2 md:mx-auto md:w-full md:max-w-xl"}`}>
        {showMap && route ? (
          <div role="group" aria-label="View" className="grid grid-cols-2 gap-2">
            {(["map", "camera"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={`min-h-11 rounded-xl border-2 border-white px-3 text-lg font-extrabold ${view === option ? "bg-white text-black" : "text-white"}`}
              >
                {option === "map" ? "3D map" : "Camera arrows"}
              </button>
            ))}
          </div>
        ) : null}

        <section aria-live="assertive" aria-atomic="true" className="flex items-center gap-3 rounded-2xl border-2 border-white p-3 sm:p-4">
          {step?.arrow && !isSafe ? <TurnArrow turn={step.arrow} /> : null}
          <div>
            {step && route && !isSafe ? (
              <p className="text-base font-semibold text-yellow-300 sm:text-lg">
                Step {index + 1} of {route.steps.length}
              </p>
            ) : null}
            <p className="text-xl leading-snug font-bold sm:text-2xl">{instruction}</p>
          </div>
        </section>

        <p aria-live="polite" className={helpStatus || error || offline ? "rounded-2xl bg-white p-3 text-lg font-bold text-black sm:text-xl" : "sr-only"}>
          {[helpStatus, error, offline ? "Connection lost. Keep following the steps; they work without a connection." : ""].filter(Boolean).join(" ")}
        </p>

        {showMap ? (
          <div className="flex flex-1 flex-col gap-3">
            {primary === "help" ? helpButton : nextButton}
            <div className="grid grid-cols-2 gap-3">
              {primary === "help" ? nextButton : helpButton}
              {repeatButton}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-3">
            {nextButton}
            {repeatButton}
            {helpButton}
          </div>
        )}
      </div>
    </main>
  );
}
