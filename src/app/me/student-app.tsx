"use client";
import { useEffect, useState } from "react";
import { ArGuide } from "@/components/ar-guide";
import { BUTTON, EndDot, MapHint, MAP_SIZE, Notice, RouteMap3D, SCREEN, ScreenHeader, ScreenTitle, StartDot, StepCard, Summary } from "@/components/sunsafe-screen";
import { speak, vibrate, VIBRATION } from "@/lib/client/announce";
import { post, useLiveState } from "@/lib/client/live";
import { findEvacuationRoute, getFloor, ground, level3 } from "@/lib/floor/building";
import { mapBearing } from "@/lib/floor/bearing";
import { pathLength, remainingPath, theStair } from "@/lib/floor/routing";
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
  const [practising, setPractising] = useState(false);

  // Earlier versions remembered the room on the phone. Forget it.
  useEffect(() => window.localStorage.removeItem("safeway.settings"), []);

  if (!place) return <LocationForm floor={level3} user={user} alarm={Boolean(state?.emergency)} onSave={setPlace} />;

  const settings: Settings = { id: user.id, name: user.name, profile: user.profile, ...place };
  if (state?.emergency) {
    return <EmergencyScreen key={state.emergency.id} settings={settings} state={state} emergency={state.emergency} offline={offline} />;
  }
  if (practising && state) {
    // The same step-by-step screen as in a real alarm, fed a pretend alarm: nothing is sent to the server.
    const drill: Emergency = { id: "practice", type: "fire", floorId: level3.id, startedAt: state.serverTime, blockedStairIds: [] };
    return <EmergencyScreen settings={settings} state={{ ...state, requests: [], safeNames: [], safeIds: [] }} emergency={drill} offline={offline} onPracticeDone={() => setPractising(false)} />;
  }
  return <Standby settings={settings} offline={offline} loading={!state} onMove={() => setPlace(null)} onPractise={() => setPractising(true)} />;
}

/** The map is the main view for everyone who can see it; blind users get the audio-first layout. */
const usesMap = (settings: Settings) => settings.profile !== "blind";

function Standby({ settings, offline, loading, onMove, onPractise }: { settings: Settings; offline: boolean; loading: boolean; onMove: () => void; onPractise: () => void }) {
  const room = level3.rooms.find((r) => r.id === settings.roomId);
  const route = findEvacuationRoute(level3.id, settings.roomId, { needsAssistance: settings.profile === "wheelchair" });
  const goesOutside = route?.path.some((p) => p.floorId === ground.id) ?? false;
  const [shownFloorId, setShownFloorId] = useState(level3.id);
  const status = offline ? "Offline · reconnecting" : loading ? "Connecting…" : "No emergency";
  const destination =
    route?.exitKind === "bombaLift" ? `${route.stairName}, then the field with a helper` : goesOutside ? "Assembly point, field" : route?.stairName;
  return (
    <main className={SCREEN}>
      <ScreenHeader pill={status} tone={offline ? "info" : "calm"} />
      <p role="status" className="sr-only">
        {offline ? "No connection. Reconnecting…" : loading ? "Connecting…" : "No emergency right now."}
      </p>

      <section className="flex flex-col gap-2">
        <ScreenTitle
          title="Your way out"
          subtitle={usesMap(settings) ? "The route you'll follow if the alarm goes off." : `${settings.name}, this is the route you'll be guided along.`}
        />
        {usesMap(settings) && route ? (
          <>
            <RouteMap3D
              route={route.path}
              startFloorId={level3.id}
              startRoomId={settings.roomId}
              shownFloorId={shownFloorId}
              onShowFloor={setShownFloorId}
              exitLabel={route.exitKind === "bombaLift" ? "Wait here · Bomba lift" : undefined}
              className={MAP_SIZE}
            />
            <MapHint />
          </>
        ) : null}
      </section>

      {route ? (
        <Summary
          rows={[
            [<><StartDot />From</>, `${room?.name ?? "Your room"}, ${level3.label}`],
            [<><EndDot />To</>, destination],
            ["Distance", `About ${route.metres} m to ${theStair(route.stairName)}`],
          ]}
        />
      ) : (
        <Notice tone="danger">No way out could be worked out from {room?.name ?? "your room"}. Ask the Health and Safety Office.</Notice>
      )}
      <p className="px-1 text-[15px] text-[#4f6970]">
        {route?.exitKind === "bombaLift"
          ? `If there's a fire, a helper takes you down in the Bomba lift and out to ${ground.assemblyPoint}. `
          : goesOutside
            ? `Down ${level3.level} floors by the emergency staircase, then out to ${ground.assemblyPoint}. `
            : ""}
        Never use the ordinary lifts in a fire. Keep this page open: if an alarm starts, directions appear here.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className={`${BUTTON.base} ${BUTTON.dark} text-lg`}
          onClick={() => {
            vibrate(VIBRATION.update);
            speak("Voice is working. You will hear evacuation instructions like this.");
          }}
        >
          Test voice and vibration
        </button>
        <button type="button" className={`${BUTTON.base} ${BUTTON.primary} text-lg`} disabled={!route || loading} onClick={onPractise}>
          {route ? `Walk me through it: ${route.steps.length} steps, read aloud` : "No route to practise"}
        </button>
      </div>
      <button type="button" className="self-start px-1 text-[15px] font-semibold text-[#4f6970] underline" onClick={onMove}>
        I have moved: change my room
      </button>
    </main>
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

const BIG = `${BUTTON.base} min-h-[12dvh] text-2xl`;
const SMALL = `${BUTTON.base} text-lg`;

type EmergencyProps = {
  settings: Settings;
  state: LiveState;
  emergency: Emergency;
  offline: boolean;
  /** Set for a practice run: every step is read aloud, nothing is sent, and this is called at the end. */
  onPracticeDone?: () => void;
};

function EmergencyScreen({ settings, state, emergency, offline, onPracticeDone }: EmergencyProps) {
  const practice = onPracticeDone !== undefined;
  // A practice run always talks: hearing the steps is the point of it.
  const voice = settings.voice || practice;
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
  const instruction = isSafe
    ? "You are marked safe. Stay at the assembly point until the all clear."
    : (step?.text ?? (practice ? intro.replace(/^Fire emergency( on [^.]+)?\./, "Practice run. This is what you will hear in a real alarm.") : intro));
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
  // A floor picked by hand lasts until the next step, then the map follows the person again.
  const [picked, setPicked] = useState({ index, floorId: shownFloor.id });
  const mapFloorId = picked.index === index ? picked.floorId : shownFloor.id;

  // The alarm itself: one long vibration when this screen first appears (a short one for a practice run).
  useEffect(() => vibrate(practice ? VIBRATION.update : VIBRATION.alarm), [practice]);

  // Screen readers announce the aria-live regions below; this is the app's own voice for everyone else.
  useEffect(() => {
    if (voice) speak(instruction);
  }, [instruction, voice]);

  useEffect(() => {
    if (!helpStatus) return;
    vibrate(VIBRATION.update);
    if (voice) speak(helpStatus);
  }, [helpStatus, voice]);

  function repeat() {
    vibrate(step ? VIBRATION[step.cue] : VIBRATION.update);
    // Repeat always speaks, even with the voice setting off: tapping it is asking to hear it.
    speak(helpStatus ? `${instruction} ${helpStatus}` : instruction);
  }

  async function next() {
    if (!route) return;
    if (atLastStep) {
      if (practice) return onPracticeDone();
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
    if (practice) return speak("This is a practice run, so no helper is called. In a real alarm, this button sends a helper to you.");
    const result = await post("/api/help", { roomId: settings.roomId });
    setError(result.error ?? "");
  }

  const nextLabel = !route
    ? "No route available"
    : atLastStep
      ? practice
        ? "Finish practice"
        : waitingHere
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
    <button key="help" type="button" onClick={askForHelp} className={`${size("help")} ${BUTTON.danger}`}>
      {helpIsOpen ? "Help requested — hear status" : "I need help"}
    </button>
  );
  const nextButton = (
    <button
      key="next"
      type="button"
      onClick={next}
      disabled={!route || isSafe || (atLastStep && waitingHere && !practice)}
      className={`${size("next")} ${BUTTON.primary}`}
    >
      {nextLabel}
    </button>
  );
  const repeatButton = (
    <button key="repeat" type="button" onClick={repeat} className={`${size("repeat")} ${BUTTON.quiet}`}>
      Repeat
    </button>
  );

  const subtitle = isSafe
    ? "You're checked in at the assembly point."
    : showMap && route
      ? route.exitKind === "bombaLift" && shownFloor.id === floor.id
        ? "Go to the Bomba lift and wait there. A helper will take you down."
        : "Follow the orange line and the white arrows to the exit."
      : "Listen to each step, then press Next step.";

  return (
    <main className={SCREEN}>
      <ScreenHeader
        pill={practice ? "Practice run · no alarm" : `Fire alarm · ${floor.label}`}
        tone={practice ? "info" : "alarm"}
        nav={practice}
        right={
          practice ? (
            <button type="button" className="text-sm font-semibold text-[#4f6970] underline" onClick={onPracticeDone}>
              Stop
            </button>
          ) : undefined
        }
      />
      <h2 className="sr-only">{practice ? "Practice run" : `Fire emergency on ${floor.label}`}</h2>

      <section className="flex flex-col gap-2">
        <ScreenTitle title="Your way out" subtitle={subtitle} />
        {showMap && route ? (
          <div role="group" aria-label="View" className="grid grid-cols-2 gap-2">
            {(["map", "camera"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={`${BUTTON.base} min-h-11 text-base ${view === option ? BUTTON.dark : BUTTON.quiet}`}
              >
                {option === "map" ? "3D map" : "Camera arrows"}
              </button>
            ))}
          </div>
        ) : null}
        {showMap && route && view === "camera" ? (
          <ArGuide
            bearing={legBearing}
            metres={legMetres}
            towards={legFloor.id === ground.id ? "the assembly point" : route.stairName}
            goingDown={goingDown}
            fallbackTurn={step?.arrow}
            className={`${MAP_SIZE} rounded-[28px]`}
          />
        ) : showMap && route ? (
          <>
            <RouteMap3D
              route={remaining}
              startFloorId={shownFloor.id}
              startRoomId={settings.roomId}
              shownFloorId={mapFloorId}
              onShowFloor={(floorId) => setPicked({ index, floorId })}
              // The Bomba lift is the end only on the alarm floor; after riding down the route carries on to the field.
              exitLabel={route.exitKind === "bombaLift" && shownFloor.id === floor.id ? "Wait here · Bomba lift" : undefined}
              blockedStairIds={emergency.blockedStairIds}
              className={MAP_SIZE}
            />
            <MapHint />
          </>
        ) : null}
      </section>

      <StepCard
        live
        label={isSafe ? "Checked in" : step && route ? `Step ${index + 1} of ${route.steps.length}` : practice ? "Practice run" : "Fire emergency"}
        text={instruction}
        turn={step?.arrow && !isSafe ? step.arrow : undefined}
      />

      <div aria-live="polite">
        {helpStatus || error || offline ? (
          <Notice tone={error ? "danger" : "info"}>
            {[helpStatus, error, offline ? "Connection lost. Keep following the steps; they work without a connection." : ""].filter(Boolean).join(" ")}
          </Notice>
        ) : null}
      </div>

      {showMap ? (
        <div className="flex flex-col gap-2">
          {primary === "help" ? helpButton : nextButton}
          <div className="grid grid-cols-2 gap-2">
            {primary === "help" ? nextButton : helpButton}
            {repeatButton}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {nextButton}
          {repeatButton}
          {helpButton}
        </div>
      )}

      {route ? (
        <Summary
          rows={[
            [<><StartDot />From</>, `${floor.rooms.find((r) => r.id === settings.roomId)?.name ?? "Your room"}, ${floor.label}`],
            [<><EndDot />{route.exitKind === "bombaLift" ? "Wait at" : "Exit"}</>, route.stairName],
            ["Then", "Assembly point, field"],
          ]}
        />
      ) : null}
    </main>
  );
}
