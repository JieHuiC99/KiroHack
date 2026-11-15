"use client";
import { useEffect, useState } from "react";
import { BUTTON, EndDot, MapHint, MAP_SIZE, Notice, RouteMap3D, SCREEN, ScreenHeader, ScreenTitle, StartDot, StepCard, Summary } from "@/components/sunsafe-screen";
import { speak, vibrate, VIBRATION } from "@/lib/client/announce";
import { post, useLiveState } from "@/lib/client/live";
import { useStored } from "@/lib/client/stored";
import { findEvacuationRoute, getFloor, ground, level3 } from "@/lib/floor/building";
import { remainingPath, theStair } from "@/lib/floor/routing";
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
        <button type="button" className={`${BUTTON.base} ${BUTTON.quiet} text-lg`} onClick={onEdit}>
          Change my details
        </button>
      </div>
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
  // The map shows one floor at a time: the floor the current step is on.
  const shownFloor = getFloor(position?.floorId ?? floor.id) ?? floor;
  const nextFloorId = route && index + 1 < route.steps.length ? route.steps[index + 1].at?.floorId : undefined;
  const nextFloor = nextFloorId && nextFloorId !== shownFloor.id ? getFloor(nextFloorId) : undefined;
  // A floor picked by hand lasts until the next step, then the map follows the person again.
  const [picked, setPicked] = useState({ index, floorId: shownFloor.id });
  const mapFloorId = picked.index === index ? picked.floorId : shownFloor.id;

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
    <button key="help" type="button" onClick={askForHelp} className={`${size("help")} ${BUTTON.danger}`}>
      {helpIsOpen ? "Help requested — hear status" : "I need help"}
    </button>
  );
  const nextButton = (
    <button
      key="next"
      type="button"
      onClick={next}
      disabled={!route || isSafe || (atLastStep && waitingHere)}
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
      ? route.exitKind === "bombaLift"
        ? "Go to the Bomba lift and wait there. A helper will take you down."
        : "Follow the orange line and the white arrows to the exit."
      : "Listen to each step, then press Next step.";

  return (
    <main className={SCREEN}>
      <ScreenHeader pill={`Fire alarm · ${floor.label}`} tone="alarm" />
      <h2 className="sr-only">Fire emergency on {floor.label}</h2>

      <section className="flex flex-col gap-2">
        <ScreenTitle title="Your way out" subtitle={subtitle} />
        {showMap && route ? (
          <>
            <RouteMap3D
              route={remaining}
              startFloorId={shownFloor.id}
              startRoomId={settings.roomId}
              shownFloorId={mapFloorId}
              onShowFloor={(floorId) => setPicked({ index, floorId })}
              exitLabel={route.exitKind === "bombaLift" ? "Wait here · Bomba lift" : undefined}
              blockedStairIds={emergency.blockedStairIds}
              className={MAP_SIZE}
            />
            <MapHint />
          </>
        ) : null}
      </section>

      <StepCard
        live
        label={isSafe ? "Checked in" : step && route ? `Step ${index + 1} of ${route.steps.length}` : "Fire emergency"}
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
