"use client";
import { useState } from "react";
import Link from "next/link";
import { FloorMap3D } from "@/components/floor-map-3d";
import { RequestList, toPins } from "@/components/request-list";
import { post, secondsSince, useLiveState } from "@/lib/client/live";
import { DEFAULT_USER } from "@/lib/default-user";
import { getFloor, level3 } from "@/lib/floor/building";
import { staircases } from "@/lib/floor/routing";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border-2 border-black p-4">
      <p className="text-3xl font-extrabold sm:text-4xl">{value}</p>
      <p>{label}</p>
    </div>
  );
}

export function Dashboard() {
  const { state, offline } = useLiveState();
  const [error, setError] = useState("");

  async function send(body: object) {
    const result = await post("/api/emergency", body);
    setError(result.error ?? "");
  }

  const emergency = state?.emergency ?? null;
  const floor = (emergency && getFloor(emergency.floorId)) || level3;
  const requests = state?.requests ?? [];
  const count = (status: string) => requests.filter((r) => r.status === status).length;
  const needsMarshal = requests.filter((r) => r.status === "pending" && r.escalationLevel === 2);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-3 text-base sm:gap-5 sm:p-5 sm:text-lg">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">SafeWay control dashboard</h1>
          <p>{DEFAULT_USER.name}</p>
          <p role="status">
            {offline
              ? "No connection. Reconnecting…"
              : !state
                ? "Connecting…"
                : emergency
                  ? `FIRE EMERGENCY ACTIVE — ${floor.building}, ${floor.label} — ${secondsSince(emergency.startedAt, state.serverTime)} s`
                  : "No active emergency."}
          </p>
        </div>
        {emergency ? (
          <button type="button" className="min-h-14 w-full rounded-xl border-2 border-black px-6 text-xl font-bold sm:w-auto" onClick={() => send({ action: "end" })}>
            End emergency (all clear)
          </button>
        ) : (
          <button
            type="button"
            className="min-h-14 w-full rounded-xl bg-red-800 px-6 text-xl font-bold text-white sm:w-auto"
            onClick={() => send({ action: "activate", floorId: level3.id })}
          >
            Simulate fire alarm — {level3.label}
          </button>
        )}
      </header>
      <nav aria-label="Demo screens" className="flex flex-wrap gap-4">
        <Link href="/me" className="underline">My evacuation</Link>
        <Link href="/responder" className="underline">Help requests and response</Link>
      </nav>
      {error ? <p role="alert" className="font-semibold text-red-800">{error}</p> : null}

      {needsMarshal.length > 0 ? (
        <p role="alert" className="rounded-xl bg-red-800 p-4 text-xl font-bold text-white">
          ESCALATED TO FLOOR MARSHAL: {needsMarshal.map((r) => r.personName).join(", ")} still {needsMarshal.length === 1 ? "has" : "have"} no helper. Send
          someone now.
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <section className="flex flex-col gap-4">
          <FloorMap3D
            floor={floor}
            pins={toPins(requests.filter((r) => r.status !== "resolved"))}
            blockedStairIds={emergency?.blockedStairIds ?? []}
            alarm={emergency !== null}
            className="h-[55dvh] min-h-72 w-full overflow-hidden rounded-xl border sm:h-[34rem]"
          />
          <p className="text-base">
            One floor at a time: use the floor buttons to switch level. Drag to rotate, scroll or pinch to zoom. Green blocks are the fire staircases, pins are
            people waiting for help, and the green field on the ground floor is the assembly point.
          </p>

          <fieldset disabled={!emergency} className="rounded-xl border-2 border-black p-4 disabled:opacity-50">
            <legend className="px-2 font-bold">Blocked staircases (routes update on every phone)</legend>
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {staircases(floor).map((stair) => (
                <label key={stair.id} className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={emergency?.blockedStairIds.includes(stair.id) ?? false}
                    onChange={(event) => send({ action: "block-stair", stairId: stair.id, blocked: event.target.checked })}
                  />
                  {stair.name}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Waiting for a helper" value={count("pending")} />
            <Stat label="Helper on the way" value={count("accepted")} />
            <Stat label="Evacuated with help" value={count("resolved")} />
            <Stat label="Checked in safe" value={state?.safeNames.length ?? 0} />
          </div>
          <div aria-live="polite">
            <h2 className="mb-2 text-xl font-bold">Help requests</h2>
            {state ? <RequestList floor={floor} state={state} /> : null}
          </div>
          <div>
            <h2 className="mb-2 text-xl font-bold">Checked in at assembly point</h2>
            <p>{state?.safeNames.length ? state.safeNames.join(", ") : "Nobody yet."}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
