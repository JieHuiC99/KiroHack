"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { SunSafeLogo } from "@/components/sunsafe-logo";
import { wayOut, type ShortStep } from "@/lib/floor/way-out";

// WebGL only exists in the browser, so the map is never rendered on the server.
const MAP_SIZE = "h-[clamp(380px,62svh,640px)] w-full";
const RouteMap3D = dynamic(() => import("@/components/route-map-3d").then((m) => m.RouteMap3D), {
  ssr: false,
  loading: () => <div className={`${MAP_SIZE} rounded-[28px] bg-[#1e4a55]`} />,
});

// Pure functions of static floor data, so it is worked out once.
const practice = wayOut();

const STEP_ICON: Record<ShortStep["kind"], string> = {
  start: "M12 19V5m0 0-5 5m5-5 5 5", // up
  turn: "M6 19V9a3 3 0 0 1 3-3h9m0 0-4-4m4 4-4 4",
  walk: "M12 19V5m0 0-5 5m5-5 5 5",
  stairs: "M4 20h4v-4h4v-4h4V8h4",
  arrive: "M5 12l5 5L20 7",
};

export function WayOutScreen() {
  const [shownFloorId, setShownFloorId] = useState(practice?.floor.id ?? "uni-l3");

  if (!practice) {
    return <main className="p-6 text-lg">The practice route could not be worked out from the floor data.</main>;
  }
  const { route, floor, room, destination, walkMetres, floorsDown, steps } = practice;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 bg-white px-3 pt-3 pb-10 text-[#17323a] sm:px-6 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-x-8">
      <header className="flex items-center justify-between gap-2 lg:col-span-2">
        <Link href="/" className="flex items-center gap-2 rounded-full pr-2 text-lg font-extrabold tracking-tight">
          <SunSafeLogo />
          SunSafe
        </Link>
        <span className="rounded-full bg-[#ffe3cc] px-3 py-1 text-xs font-bold text-[#8a3f0c]">Practice route · sample data</span>
      </header>

      <section aria-labelledby="way-out-title" className="flex flex-col gap-2">
        <div className="px-1">
          <h1 id="way-out-title" className="text-[28px] leading-tight font-extrabold">
            Your way out
          </h1>
          <p className="text-[15px] text-[#4f6970]">Follow the orange line and the white arrows to the exit.</p>
        </div>

        <RouteMap3D
          route={route.path}
          startFloorId={floor.id}
          startRoomId={room.id}
          shownFloorId={shownFloorId}
          onShowFloor={setShownFloorId}
          className={MAP_SIZE}
        />
        <p className="text-center text-xs text-[#6b8288]">Drag to rotate · pinch to zoom</p>
      </section>

      <section aria-label="Directions" className="flex flex-col gap-3 lg:pt-[76px]">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 rounded-2xl bg-[#eef7f4] px-4 py-3 text-[15px]">
          <dt className="flex items-center gap-2 text-[#4f6970]">
            <span aria-hidden="true" className="size-3 rounded-full bg-[#2f6fed] ring-2 ring-white" />
            From
          </dt>
          <dd className="font-bold">
            {room.name}, {floor.label}
          </dd>
          <dt className="flex items-center gap-2 text-[#4f6970]">
            <span aria-hidden="true" className="size-3 rounded-[4px] bg-[#ff7a1a] ring-2 ring-white" />
            To
          </dt>
          <dd className="font-bold">{destination}</dd>
          <dt className="text-[#4f6970]">Distance</dt>
          <dd>
            About {walkMetres} m walking
            {floorsDown > 0 ? ` + ${floorsDown} flights of stairs` : ""}
          </dd>
        </dl>

        <ol className="flex flex-col">
          {steps.map((step, i) => {
            const onShown = step.floorId === shownFloorId;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setShownFloorId(step.floorId)}
                  className={`flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left text-[16px] leading-snug ${onShown ? "" : "text-[#6b8288]"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-7 flex-none items-center justify-center rounded-full text-[13px] font-bold ${
                      step.kind === "arrive" ? "bg-[#c9ecd8] text-[#14532d]" : onShown ? "bg-[#ffe3cc] text-[#8a3f0c]" : "bg-[#f1f3f3] text-[#6b8288]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 pt-0.5">{step.text}</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-1 size-5 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={STEP_ICON[step.kind]} />
                  </svg>
                </button>
              </li>
            );
          })}
        </ol>

        <p className="rounded-xl border border-[#ffd9b8] bg-[#fff7f0] px-3 py-2 text-[13px] leading-snug text-[#7a4a22]">
          Practice route on sample data traced by hand from the Sunway University campus map. Distances are estimates from that
          trace. Not checked against the posted evacuation plans, so don&apos;t rely on it in a real emergency.
        </p>
      </section>
    </main>
  );
}
