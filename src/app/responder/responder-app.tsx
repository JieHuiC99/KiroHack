"use client";
import { useEffect, useState } from "react";
import { RequestList, roomName } from "@/components/request-list";
import { BUTTON, FIELD, MapHint, MAP_SIZE, Notice, RouteMap3D, SCREEN, ScreenHeader, ScreenTitle, Summary } from "@/components/sunsafe-screen";
import { vibrate, VIBRATION } from "@/lib/client/announce";
import { post, useLiveState } from "@/lib/client/live";
import { useStored } from "@/lib/client/stored";
import { findEvacuationRoute, getFloor, level3 } from "@/lib/floor/building";

export function ResponderApp() {
  const { value: name, save, ready } = useStored<string>("safeway.responder");
  const { state, offline } = useLiveState();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  // Buzz whenever something new needs attention: a new request, or one that just escalated.
  const attention = (state?.requests ?? [])
    .filter((r) => r.status === "pending")
    .map((r) => `${r.id}:${r.escalationLevel}`)
    .join(",");
  useEffect(() => {
    if (attention) vibrate(VIBRATION.alarm);
  }, [attention]);

  if (!ready) return null;
  if (!name) {
    return (
      <main className={`${SCREEN} text-lg`}>
        <ScreenHeader pill="Responder" tone="info" />
        <ScreenTitle title="Responder sign-in" subtitle="People who ask for help will see your name when you accept." />
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim()) save(draft.trim());
          }}
        >
          <label className="flex flex-col gap-2 font-bold">
            Your name
            <input required value={draft} onChange={(event) => setDraft(event.target.value)} className={FIELD} />
          </label>
          <button type="submit" className={`${BUTTON.base} ${BUTTON.primary} text-2xl`}>
            Continue
          </button>
        </form>
      </main>
    );
  }

  const floor = (state?.emergency && getFloor(state.emergency.floorId)) || level3;
  const blocked = state?.emergency?.blockedStairIds ?? [];
  const mine = state?.requests.find((r) => r.status === "accepted" && r.responderName === name);
  // Show the person's route to their waiting point, so the responder knows where to meet them.
  const route = mine ? findEvacuationRoute(floor.id, mine.roomId, { blockedStairIds: blocked, needsAssistance: true }) : null;
  async function act(id: string, body: object) {
    const result = await post(`/api/help/${id}`, body);
    setError(result.error ?? "");
  }

  const open = state?.requests.filter((r) => r.status !== "resolved") ?? [];
  const pending = open.filter((r) => r.status === "pending").length;
  const pill = offline ? "Offline" : !state ? "Connecting…" : state.emergency ? (pending > 0 ? `${pending} need help` : `Fire alarm · ${floor.label}`) : "No emergency";
  const waitAt = mine?.waitStairId ? roomName(floor, mine.waitStairId) : null;

  return (
    <main className={SCREEN}>
      <ScreenHeader
        pill={pill}
        tone={state?.emergency ? "alarm" : offline ? "info" : "calm"}
        right={
          <button type="button" className="text-sm font-semibold text-[#4f6970] underline" onClick={() => save(null)}>
            Switch user
          </button>
        }
      />
      <p role="status" className="sr-only">
        {offline ? "No connection. Reconnecting…" : !state ? "Connecting…" : state.emergency ? `Fire emergency — ${floor.building}, ${floor.label}` : "No emergency right now."}
      </p>

      <section className="flex flex-col gap-2">
        <ScreenTitle
          title={mine ? `Go to ${mine.personName}` : state?.emergency ? "Help requests" : `Hi ${name}`}
          subtitle={
            mine
              ? waitAt
                ? `${mine.personName} is waiting at ${waitAt}.`
                : `${mine.personName} has no usable exit and is staying in ${roomName(floor, mine.roomId)}.`
              : state?.emergency
                ? "Red pins are people waiting for help. Accept one to see their route."
                : "Keep this page open. Your phone buzzes when someone asks for help."
          }
        />
        {state?.emergency ? (
          <>
            <RouteMap3D
              route={route?.path ?? []}
              startFloorId={floor.id}
              startRoomId={mine?.roomId ?? ""}
              shownFloorId={picked ?? floor.id}
              onShowFloor={setPicked}
              hereLabel={mine ? `${mine.personName}'s room` : undefined}
              exitLabel={mine ? `${mine.personName} waits here` : undefined}
              blockedStairIds={blocked}
              pins={mine ? [] : open.flatMap((r) => (r.roomId ? [{ id: r.id, roomId: r.roomId, label: r.personName }] : []))}
              className={MAP_SIZE}
            />
            <MapHint />
          </>
        ) : null}
      </section>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {mine ? (
        <Summary
          rows={[
            ["Person", mine.personName],
            ["From", roomName(floor, mine.roomId)],
            ["Waiting at", waitAt ?? "Their room"],
          ]}
        />
      ) : null}

      {state?.emergency ? (
        <section aria-live="polite" className="flex flex-col gap-2">
          <h2 className="px-1 text-lg font-extrabold">All requests</h2>
          <RequestList
            floor={floor}
            state={state}
            actions={(request) =>
              request.status === "pending" ? (
                <button type="button" className={`${BUTTON.base} ${BUTTON.primary} w-full`} onClick={() => act(request.id, { action: "accept", responderName: name })}>
                  Accept: I&apos;ll help {request.personName}
                </button>
              ) : request.status === "accepted" && request.responderName === name ? (
                <button type="button" className={`${BUTTON.base} ${BUTTON.quiet} w-full`} onClick={() => act(request.id, { action: "resolve" })}>
                  Mark {request.personName} evacuated
                </button>
              ) : null
            }
          />
        </section>
      ) : null}
    </main>
  );
}
