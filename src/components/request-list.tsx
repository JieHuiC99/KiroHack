"use client";
import { secondsSince } from "@/lib/client/live";
import type { MapPin } from "@/components/floor-map-3d";
import type { Floor } from "@/lib/floor/types";
import type { LiveState } from "@/lib/validation/emergency";

export type HelpRequest = LiveState["requests"][number];

const PROFILE_LABEL: Record<HelpRequest["profile"], string> = {
  blind: "Blind / low vision",
  wheelchair: "Wheelchair / cannot use stairs",
  other: "Needs assistance",
};

const ESCALATION_LABEL = ["First responder notified", "ESCALATED — all responders notified", "ESCALATED — floor marshal and emergency team notified"];

export function roomName(floor: Floor, roomId: string | null) {
  return floor.rooms.find((r) => r.id === roomId)?.name ?? "Unknown location";
}

export function statusLabel(request: HelpRequest) {
  if (request.status === "resolved") return "Resolved — evacuated";
  if (request.status === "accepted") return `Accepted by ${request.responderName}`;
  return ESCALATION_LABEL[request.escalationLevel];
}

export function toPins(requests: HelpRequest[]): MapPin[] {
  return requests.map((r) => ({
    id: r.id,
    roomId: r.roomId,
    label: r.personName,
    tone: r.status === "pending" ? (r.escalationLevel > 0 ? "escalated" : "pending") : r.status,
  }));
}

const STATUS_STYLE: Record<HelpRequest["status"], string> = {
  pending: "border-red-700 bg-red-50",
  accepted: "border-amber-600 bg-amber-50",
  resolved: "border-green-700 bg-green-50",
};

/** Help requests as text cards. Status is always written out, never shown by colour alone. */
export function RequestList({
  floor,
  state,
  actions,
}: {
  floor: Floor;
  state: LiveState;
  actions?: (request: HelpRequest) => React.ReactNode;
}) {
  if (state.requests.length === 0) return <p className="text-lg">No help requests.</p>;
  return (
    <ul className="flex flex-col gap-3" data-testid="request-list">
      {state.requests.map((request) => (
        <li key={request.id} className={`rounded-xl border-2 p-4 ${STATUS_STYLE[request.status]}`}>
          <p className="text-xl font-bold">{request.personName}</p>
          <p>{PROFILE_LABEL[request.profile]}</p>
          <p>
            From {roomName(floor, request.roomId)}
            {request.waitStairId
              ? ` · waiting at ${roomName(floor, request.waitStairId)}${request.waitStairId.startsWith("stair-") ? " landing" : ""}`
              : " · no usable exit, staying in room"}
          </p>
          <p className="font-semibold">
            {statusLabel(request)}
            {request.status === "pending" ? ` · waiting ${secondsSince(request.createdAt, state.serverTime)} s` : ""}
          </p>
          {actions ? <div className="mt-3">{actions(request)}</div> : null}
        </li>
      ))}
    </ul>
  );
}
