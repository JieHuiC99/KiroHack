import { profiles, type Profile } from "@/lib/validation/emergency";

// Who may do what. Pure: shared by the server (the real checks) and the screens (what to show).
//
// A role is never chosen by the person and never stored: it is worked out on the server, on every
// request, from two lists of email addresses in the environment. Everyone else is a student.
// The accessibility profile is different: it grants nothing, so people pick it themselves at sign-in.

export const roles = ["student", "responder", "team"] as const;
/** student: evacuates. responder: also helps people who ask. team: the disaster recovery team, runs the alarm. */
export type Role = (typeof roles)[number];

export type AppUser = { id: string; name: string; role: Role; profile: Profile };

const listed = (list: string | undefined, email: string) =>
  (list ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean) // an empty list must never match an empty address
    .includes(email.trim().toLowerCase());

type RoleLists = Record<string, string | undefined> & { EMERGENCY_TEAM_EMAILS?: string; RESPONDER_EMAILS?: string };

export function roleFor(email: string, lists: RoleLists = process.env): Role {
  if (listed(lists.EMERGENCY_TEAM_EMAILS, email)) return "team";
  if (listed(lists.RESPONDER_EMAILS, email)) return "responder";
  return "student";
}

/** The profile column is free text in the auth table, so anything unexpected falls back to the default. */
export function toProfile(value: unknown): Profile {
  return profiles.find((p) => p === value) ?? "other";
}

export const ROLE_LABEL: Record<Role, string> = { student: "Student or staff", responder: "Responder", team: "Disaster recovery team" };
export const PROFILE_LABEL: Record<Profile, string> = {
  other: "can see the screen and use stairs",
  blind: "blind or low vision",
  wheelchair: "wheelchair user or cannot use stairs",
};

/** `short` is the label in the header's nav bar; screens without one are only listed on the home page. */
export const SCREENS: { href: string; title: string; short?: string; text: string; roles: readonly Role[] }[] = [
  { href: "/me", title: "My evacuation", short: "My evacuation", text: "Your way out: 3D map, camera arrows, voice and vibration.", roles },
  { href: "/route", title: "Your way out (practice route)", short: "Practice route", text: "3D map: follow the orange line from UC-3-3 to the exit and out to the field. No setup needed.", roles },
  { href: "/guide/lt5-green-zone", title: "Camera route: LT5 to Green zone", short: "LT5 camera route", text: "Scan the QR codes on the walls from Lecture Theatre 5 and follow the arrow outside.", roles },
  { href: "/responder", title: "Responder", short: "Responder", text: "Accept a help request, find the person, mark them evacuated.", roles: ["responder", "team"] },
  { href: "/dashboard", title: "Control dashboard", short: "Dashboard", text: "Trigger the alarm, block staircases and Bomba lifts, watch requests on the map.", roles: ["team"] },
  { href: "/guide/lt5-green-zone/print", title: "Print route QR codes", text: "The QR code for each landmark on the LT5 route, to stick on the walls.", roles: ["team"] },
  { href: "/monitor", title: "Venue monitor", short: "Monitor", text: "Which classrooms have classes now, who has acknowledged the alarm, CCTV, repeat the siren.", roles: ["team"] },
];

/** Where someone lands after signing in. */
export function homeFor(role: Role) {
  return role === "team" ? "/dashboard" : role === "responder" ? "/responder" : "/me";
}
