import type { Profile } from "@/lib/validation/emergency";

export type Role = "administrator";
export type AppUser = { id: string; name: string; role: Role; profile: Profile };

// Every screen is available to the shared Emergency administrator.
export const SCREENS: { href: string; title: string; text: string }[] = [
  { href: "/me", title: "My evacuation", text: "Your way out: 3D map, camera arrows, voice and vibration." },
  { href: "/route", title: "Your way out (practice route)", text: "3D map: follow the orange line from UC-3-3 to the exit and out to the field. No setup needed." },
  { href: "/guide/lt5-green-zone", title: "Camera route: LT5 to Green zone", text: "Scan the QR codes on the walls from Lecture Theatre 5 and follow the arrow outside." },
  { href: "/responder", title: "Responder", text: "Accept a help request, find the person, mark them evacuated." },
  { href: "/dashboard", title: "Control dashboard", text: "Trigger the alarm, block staircases and Bomba lifts, watch requests on the map." },
  { href: "/guide/lt5-green-zone/print", title: "Print route QR codes", text: "The QR code for each landmark on the LT5 route, to stick on the walls." },
  { href: "/monitor", title: "Venue monitor", text: "Which classrooms have classes now, who has acknowledged the alarm, CCTV, repeat the siren." },
];
