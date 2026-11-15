"use client";
import { useEffect, useState } from "react";
import { FloorMap3D } from "@/components/floor-map-3d";
import { RequestList, toPins } from "@/components/request-list";
import { vibrate, VIBRATION } from "@/lib/client/announce";
import { post, useLiveState } from "@/lib/client/live";
import { useStored } from "@/lib/client/stored";
import { findEvacuationRoute, getFloor, level3 } from "@/lib/floor/building";

export function ResponderApp() {
  const { value: name, save, ready } = useStored<string>("safeway.responder");
  const { state, offline } = useLiveState();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

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
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 p-6 text-xl">
        <h1 className="text-3xl font-bold">Responder sign-in</h1>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim()) save(draft.trim());
          }}
        >
          <label className="flex flex-col gap-2 font-semibold">
            Your name
            <input required value={draft} onChange={(event) => setDraft(event.target.value)} className="rounded-lg border-2 border-black p-4 font-normal" />
          </label>
          <button type="submit" className="min-h-16 rounded-xl bg-black p-4 text-2xl font-bold text-white">
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
  // Before accepting, look at the emergency floor; after accepting, zoom to the person's route.
  const floorCorners = floor.corridors.flatMap((c) => [
    { x: c.x, y: c.y, floorId: floor.id },
    { x: c.x + c.w, y: c.y + c.h, floorId: floor.id },
  ]);

  async function act(id: string, body: object) {
    const result = await post(`/api/help/${id}`, body);
    setError(result.error ?? "");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 p-3 text-base sm:p-4 sm:text-lg">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Responder: {name}</h1>
        <button type="button" className="underline" onClick={() => save(null)}>
          Switch user
        </button>
      </header>

      <p role="status" className="rounded-xl border-2 border-black p-4 text-xl font-semibold">
        {offline ? "No connection. Reconnecting…" : !state ? "Connecting…" : state.emergency ? `FIRE EMERGENCY — ${floor.building}, ${floor.label}` : "No emergency right now."}
      </p>
      {error ? <p role="alert" className="font-semibold text-red-800">{error}</p> : null}

      {state?.emergency ? (
        <>
          <FloorMap3D
            floor={floor}
            pins={toPins(state.requests.filter((r) => r.status !== "resolved"))}
            route={route?.path}
            focus={route?.path ?? floorCorners}
            blockedStairIds={blocked}
            className="h-[38dvh] min-h-56 w-full overflow-hidden rounded-xl border"
          />
          <section aria-live="polite">
            <h2 className="mb-2 text-xl font-bold">Help requests</h2>
            <RequestList
              floor={floor}
              state={state}
              actions={(request) =>
                request.status === "pending" ? (
                  <button
                    type="button"
                    className="min-h-14 w-full rounded-xl bg-red-800 p-3 text-xl font-bold text-white"
                    onClick={() => act(request.id, { action: "accept", responderName: name })}
                  >
                    Accept — I&apos;ll help {request.personName}
                  </button>
                ) : request.status === "accepted" && request.responderName === name ? (
                  <button
                    type="button"
                    className="min-h-14 w-full rounded-xl bg-green-800 p-3 text-xl font-bold text-white"
                    onClick={() => act(request.id, { action: "resolve" })}
                  >
                    Mark {request.personName} as evacuated
                  </button>
                ) : null
              }
            />
          </section>
        </>
      ) : null}
    </main>
  );
}
