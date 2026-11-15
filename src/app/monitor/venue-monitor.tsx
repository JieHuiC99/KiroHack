"use client";
import Link from "next/link";
import { useState } from "react";
import { post, secondsSince, usePolled } from "@/lib/client/live";
import type { VenueAction, VenueBoard, VenueStatus } from "@/lib/validation/venues";
import { venueGroups } from "@/lib/venues";

const CCTV_URL_TEMPLATE = process.env.NEXT_PUBLIC_CCTV_URL_TEMPLATE;

const FILTERS = [
  { id: "all", label: "All venues" },
  { id: "in-use", label: "In use now" },
  { id: "waiting", label: "Not acknowledged" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const isWaiting = (venue: VenueStatus) => venue.alert !== null && !venue.alert.acknowledged && !venue.alert.cleared;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border-2 border-black p-3 sm:p-4">
      <p className="text-3xl font-extrabold sm:text-4xl">{value}</p>
      <p>{label}</p>
    </div>
  );
}

/** The room's camera. Real feeds come from NEXT_PUBLIC_CCTV_URL_TEMPLATE; without it there is nothing to show, and it says so. */
function Cctv({ venue }: { venue: VenueStatus }) {
  if (CCTV_URL_TEMPLATE) {
    return (
      // A camera stream, not a page asset: next/image can't optimise it.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={CCTV_URL_TEMPLATE.replace("{venue}", encodeURIComponent(venue.id))}
        alt={`Live CCTV of ${venue.name}`}
        className="aspect-video w-full rounded-lg bg-black object-cover"
      />
    );
  }
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg bg-neutral-900 p-3 text-center font-mono text-sm text-neutral-200">
      <p className="font-bold">CAM {venue.name.toUpperCase()}</p>
      <p>No camera connected in this demo.</p>
      <p className="text-neutral-400">Set NEXT_PUBLIC_CCTV_URL_TEMPLATE to show the live feed here.</p>
    </div>
  );
}

function alertText(venue: VenueStatus) {
  const alert = venue.alert;
  if (!alert) return "";
  if (alert.cleared) return "Room confirmed empty";
  const round = alert.sirenRound > 1 ? ` (siren ${alert.sirenRound})` : "";
  if (!alert.acknowledged) return `NOT ACKNOWLEDGED${round} — siren is sounding in the room`;
  const at = alert.acknowledgedAt ? new Date(alert.acknowledgedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  return `Acknowledged${round} at ${at} — evacuating, check the camera`;
}

function VenueCard({ venue, act }: { venue: VenueStatus; act: (venueId: string, action: VenueAction) => void }) {
  const [showCamera, setShowCamera] = useState(false);
  const alert = venue.alert;
  const tone = !alert
    ? "border-black"
    : alert.cleared
      ? "border-green-700 bg-green-50"
      : alert.acknowledged
        ? "border-amber-600 bg-amber-50"
        : "border-red-700 bg-red-50";
  const button = "min-h-11 rounded-lg px-3 font-bold";

  return (
    <li className={`flex flex-col gap-2 rounded-xl border-2 p-3 sm:p-4 ${tone}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-xl font-bold">{venue.name}</h3>
        <p>
          {venue.level} · {venue.seats} seats
        </p>
      </div>
      {venue.session ? (
        <p>
          <strong>
            {venue.session.code} {venue.session.title}
          </strong>
          <br />
          {venue.session.lecturer} · {venue.session.startsAt} to {venue.session.endsAt} · {venue.session.students} students
        </p>
      ) : (
        <p>Free now: no class timetabled.</p>
      )}
      {alert ? <p className="font-bold">{alertText(venue)}</p> : null}

      {showCamera ? <Cctv venue={venue} /> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-expanded={showCamera} onClick={() => setShowCamera(!showCamera)} className={`${button} border-2 border-black`}>
          {showCamera ? "Hide CCTV" : "View CCTV"}
        </button>
        {alert ? (
          <>
            <button type="button" onClick={() => act(venue.id, "siren")} className={`${button} bg-red-800 text-white`}>
              Still occupied: repeat siren
            </button>
            <button type="button" onClick={() => act(venue.id, alert.cleared ? "occupied" : "clear")} className={`${button} border-2 border-black`}>
              {alert.cleared ? "Undo: not empty" : "Room is empty"}
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}

/** For the disaster recovery team: which rooms have classes, which have answered the alarm, and their cameras. */
export function VenueMonitor() {
  const { state, offline } = usePolled<VenueBoard>("/api/venues");
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");

  async function act(venueId: string, action: VenueAction) {
    const result = await post(`/api/venues/${venueId}`, { action });
    setError(result.error ?? "");
  }

  const all = state?.venues ?? [];
  const alarm = state?.emergency ?? null;
  const shown = all.filter((v) => (filter === "in-use" ? v.session !== null : filter === "waiting" ? isWaiting(v) : true));
  const inUse = all.filter((v) => v.session !== null);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-3 text-base sm:gap-5 sm:p-5 sm:text-lg">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">SunSafe venue monitor</h1>
          <p role="status">
            {offline
              ? "No connection. Reconnecting…"
              : !state
                ? "Connecting…"
                : alarm
                  ? `FIRE ALARM ACTIVE — ${alarm.floorLabel} — ${secondsSince(alarm.startedAt, state.serverTime)} s. Every classroom screen is sounding until it is acknowledged.`
                  : "No active emergency. Showing who is in each room now."}
          </p>
        </div>
        <Link href="/dashboard" className="flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-black px-6 text-xl font-bold sm:w-auto">
          {alarm ? "Control dashboard" : "Trigger alarm on the dashboard"}
        </Link>
      </header>
      {error ? <p role="alert" className="font-semibold text-red-800">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Rooms in use now" value={inUse.length} />
        <Stat label="People in those rooms" value={inUse.reduce((sum, v) => sum + (v.session?.students ?? 0), 0)} />
        <Stat label="Not acknowledged" value={all.filter(isWaiting).length} />
        <Stat label="Confirmed empty" value={all.filter((v) => v.alert?.cleared).length} />
      </div>

      <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
            className={`min-h-11 rounded-lg border-2 border-black px-4 font-bold ${filter === option.id ? "bg-black text-white" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="flex flex-col gap-5">
        {venueGroups.map((group) => {
          const rooms = shown.filter((v) => v.group === group);
          if (rooms.length === 0) return null;
          return (
            <section key={group}>
              <h2 className="mb-2 text-xl font-bold">
                {group} <span className="font-normal">· {rooms.filter((v) => v.session).length} in use</span>
              </h2>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid={`venues-${group}`}>
                {rooms.map((venue) => (
                  <VenueCard key={venue.id} venue={venue} act={act} />
                ))}
              </ul>
            </section>
          );
        })}
        {state && shown.length === 0 ? <p>No venues match this filter.</p> : null}
      </div>
      <p className="text-base">Demo timetable: the classes shown are generated, not the real university timetable.</p>
    </main>
  );
}
