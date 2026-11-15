"use client";
import { useEffect, useState } from "react";
import { FloorMap3D } from "@/components/floor-map-3d";
import { speak, vibrate, VIBRATION } from "@/lib/client/announce";
import { post, useLiveState } from "@/lib/client/live";
import { useStored } from "@/lib/client/stored";
import { findEvacuationRoute, getFloor, ground, level3 } from "@/lib/floor/building";
import { theStair } from "@/lib/floor/routing";
import type { Turn } from "@/lib/floor/types";
import type { LiveState } from "@/lib/validation/emergency";
import { SetupForm, type Settings } from "./setup-form";

type Emergency = NonNullable<LiveState["emergency"]>;
type HelpRequest = LiveState["requests"][number];

const SETTINGS_KEY = "safeway.settings";

export function StudentApp() {
  const { value: settings, save, ready } = useStored<Settings>(SETTINGS_KEY);
  const { state, offline } = useLiveState();
  const [editing, setEditing] = useState(false);

  if (!ready) return null;
  if (!settings || editing) {
    return (
      <SetupForm
        floor={level3}
        initial={settings}
        onSave={(next) => {
          save(next);
          setEditing(false);
        }}
      />
    );
  }
  if (state?.emergency) {
    return <EmergencyScreen key={state.emergency.id} settings={settings} state={state} emergency={state.emergency} offline={offline} />;
  }
  return <Standby settings={settings} offline={offline} loading={!state} onEdit={() => setEditing(true)} />;
}

/** The map is the main view for everyone who can see it; blind users get the audio-first layout. */
const usesMap = (settings: Settings) => settings.profile !== "blind";

function Standby({ settings, offline, loading, onEdit }: { settings: Settings; offline: boolean; loading: boolean; onEdit: () => void }) {
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
            className="h-[42dvh] min-h-64 w-full overflow-hidden rounded-xl border-2 border-black"
          />
          <p>
            From {room?.name}, {level3.label}: about {route.metres} metres to <strong>{theStair(route.stairName)}</strong>
            {goesOutside ? `, down ${level3.level} floors, then out to ${ground.assemblyPoint}` : ", where a helper meets you on the landing"}. Drag to rotate,
            pinch to zoom.
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
        <button type="button" className="min-h-16 rounded-xl border-2 border-black p-4 text-xl font-bold" onClick={onEdit}>
          Change my details
        </button>
      </div>
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
  const myRequest = state.requests.findLast((r) => r.personName === settings.name);
  const isSafe = state.safeNames.includes(settings.name);
  const needsAssistance = settings.profile === "wheelchair" || (myRequest !== undefined && myRequest.status !== "resolved");
  const route = findEvacuationRoute(floor.id, settings.roomId, { blockedStairIds: emergency.blockedStairIds, needsAssistance });
  const showMap = usesMap(settings);

  // Progress belongs to one route. If a staircase gets blocked the route changes and we start again.
  const routeKey = `${route?.stairId}:${needsAssistance}`;
  const [progress, setProgress] = useState({ routeKey, index: -1 });
  const index = progress.routeKey === routeKey ? progress.index : -1;
  const [error, setError] = useState("");
  const [wholeBuilding, setWholeBuilding] = useState(false);

  const rerouted = emergency.blockedStairIds.length > 0;
  const start = showMap ? "Follow the arrows on the map" : "Press Next step to begin";
  const intro = !route
    ? "Fire emergency. Every staircase on this floor is reported blocked. Stay where you are, keep low, and press I need help."
    : settings.profile === "wheelchair"
      ? `Fire emergency on ${floor.label}. Do not use the lift. Press I need help, then follow the arrows to the landing of ${theStair(route.stairName)}.`
      : `Fire emergency on ${floor.label}. Do not use the lift. ${rerouted ? `A staircase is blocked. ` : ""}${start} to ${theStair(route.stairName)}, about ${route.metres} metres.`;

  const step = route && index >= 0 ? route.steps[index] : undefined;
  const instruction = isSafe ? "You are marked safe. Stay at the assembly point until the all clear." : (step?.text ?? intro);
  const helpStatus = helpStatusText(myRequest);
  const atLastStep = route !== null && index === route.steps.length - 1;
  const helpIsOpen = myRequest !== undefined && myRequest.status !== "resolved";
  const position = route ? (step?.at ?? route.path[0]) : undefined;
  // The map shows one floor at a time: the floor the current step is on.
  const shownFloor = getFloor(position?.floorId ?? floor.id) ?? floor;
  const onShownFloor = route?.path.filter((p) => p.floorId === shownFloor.id) ?? [];
  const floorCorners = shownFloor.corridors.flatMap((c) => [
    { x: c.x, y: c.y, floorId: shownFloor.id },
    { x: c.x + c.w, y: c.y + c.h, floorId: shownFloor.id },
  ]);
  // Zoom to the route on this floor; on floors you only pass through, show the whole floor.
  const focus = wholeBuilding ? route?.path : onShownFloor.length > 1 ? onShownFloor : floorCorners;
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
      const result = await post("/api/checkin", { personName: settings.name });
      setError(result.error ?? "");
      return;
    }
    const nextIndex = index + 1;
    vibrate(VIBRATION[route.steps[nextIndex].cue]);
    setProgress({ routeKey, index: nextIndex });
  }

  async function askForHelp() {
    if (helpIsOpen) return repeat();
    const result = await post("/api/help", { personName: settings.name, profile: settings.profile, roomId: settings.roomId });
    setError(result.error ?? "");
  }

  const nextLabel = !route
    ? "No route available"
    : atLastStep
      ? needsAssistance
        ? "Wait here for your helper"
        : "I am safe at the assembly point"
      : index === -1
        ? "Start: next step"
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
      disabled={!route || isSafe || (atLastStep && needsAssistance)}
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
    <main className="flex min-h-dvh flex-col bg-black text-white md:grid md:h-dvh md:grid-cols-[3fr_2fr] md:grid-rows-[auto_1fr]">
      <h1 className="p-3 text-center text-xl font-extrabold tracking-wide text-yellow-300 sm:text-2xl md:col-span-2">
        FIRE EMERGENCY — {floor.label.toUpperCase()}
      </h1>

      {showMap && route ? (
        <div className="relative h-[40dvh] min-h-56 w-full md:h-full">
          <FloorMap3D
            floor={floor}
            route={route.path}
            position={position}
            focus={focus}
            visibleFloorIds={wholeBuilding ? undefined : [shownFloor.id]}
            blockedStairIds={emergency.blockedStairIds}
            highlightRoomId={settings.roomId}
            className="size-full"
          />
          <p className="absolute top-2 left-2 rounded-lg bg-black/80 px-3 py-2 text-base font-bold text-white">
            {wholeBuilding ? "Whole building" : shownFloor.label}
          </p>
          <button
            type="button"
            aria-pressed={wholeBuilding}
            onClick={() => setWholeBuilding(!wholeBuilding)}
            className="absolute top-2 right-2 min-h-11 rounded-lg bg-black/80 px-3 text-base font-bold text-white"
          >
            {wholeBuilding ? "This floor only" : "Whole building"}
          </button>
        </div>
      ) : null}

      <div className={`flex flex-1 flex-col gap-3 p-3 ${showMap && route ? "" : "md:col-span-2 md:mx-auto md:w-full md:max-w-xl"}`}>
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
