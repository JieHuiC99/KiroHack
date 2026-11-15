"use client";
import Link from "next/link";
import { ScreenHeader } from "@/components/sunsafe-screen";
import { useState } from "react";
import { post, secondsSince, usePolled } from "@/lib/client/live";
import type { VenueAction, VenueBoard, VenueStatus } from "@/lib/validation/venues";
import type { AppUser } from "@/lib/roles";
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
    <div className="rounded-2xl bg-[#eef7f4] p-3 sm:p-4">
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
        className="aspect-video w-full rounded-2xl bg-black object-cover"
      />
    );
  }
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-2xl bg-neutral-900 p-3 text-center font-mono text-sm text-neutral-200">
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
    ? "border-[#cfe0dc]"
    : alert.cleared
      ? "border-[#9ccfbd] bg-[#eef7f4]"
      : alert.acknowledged
        ? "border-[#f5c451] bg-[#fff4d6]"
        : "border-[#e7a39d] bg-[#fde8e7]";
  const button = "min-h-11 rounded-2xl px-3 font-bold";

  return (
    <li className={`flex flex-col gap-2 rounded-2xl border-2 p-3 sm:p-4 ${tone}`}>
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
        <button type="button" aria-expanded={showCamera} onClick={() => setShowCamera(!showCamera)} className={`${button} border-2 border-[#cfe0dc]`}>
          {showCamera ? "Hide CCTV" : "View CCTV"}
        </button>
        {alert ? (
          <>
            <button type="button" onClick={() => act(venue.id, "siren")} className={`${button} bg-[#c62828] text-white`}>
              Still occupied: repeat siren
            </button>
            <button type="button" onClick={() => act(venue.id, alert.cleared ? "occupied" : "clear")} className={`${button} border-2 border-[#cfe0dc]`}>
              {alert.cleared ? "Undo: not empty" : "Room is empty"}
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}

/** For the disaster recovery team: which rooms have classes, which have answered the alarm, and their cameras. */
export function VenueMonitor({ user }: { user: AppUser }) {
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 bg-white px-3 pt-3 pb-10 text-base text-[#17323a] sm:gap-5 sm:px-5 sm:text-lg">
      <ScreenHeader pill={alarm ? "Fire alarm active" : offline ? "Offline" : "No emergency"} tone={alarm ? "alarm" : offline ? "info" : "calm"} />
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight font-extrabold">Venue monitor</h1>
          <p className="text-[15px] text-[#4f6970]">
            {user.name} · disaster recovery team
          </p>
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
        <Link href="/dashboard" className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#ffd84d] px-6 text-xl font-extrabold text-[#3d2c00] sm:w-auto">
          {alarm ? "Control dashboard" : "Trigger alarm on the dashboard"}
        </Link>
      </header>
      {error ? <p role="alert" className="font-semibold text-[#8f1d14]">{error}</p> : null}

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
            className={`min-h-11 rounded-2xl border-2 px-4 font-bold ${filter === option.id ? "border-[#17323a] bg-[#17323a] text-white" : "border-[#9ccfbd] bg-[#eef7f4]"}`}
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
