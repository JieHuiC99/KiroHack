import type { Turn } from "@/lib/floor/types";

// Evacuation routes described the way people walk them: a chain of landmarks, each with a photo, a QR
// code on the wall and "which way from here". Pure data, shared by the guide screen and the QR sheet.
//
// ⚠ Traced from eight photos and four answers from the person who walked it, not from a survey. Walk it
// with the app once, and get it confirmed by the Health & Safety Office, before anyone relies on it.

export type Checkpoint = {
  id: string;
  title: string;
  level: string;
  /** What to look for to know you are there. */
  look: string;
  /** What to do from here, spoken and shown. */
  instruction: string;
  /**
   * Which way to go, standing at the landmark and FACING it (that is how you stand to scan its QR code).
   * "down" = take the stairs down; "arrive" = the end of the route.
   */
  go: Turn | "down" | "arrive";
  image: string;
};

export type LandmarkRoute = { id: string; name: string; from: string; to: string; checkpoints: Checkpoint[] };

const photo = (name: string) => `/guide/lt5/${name}.jpg`;

export const lt5ToGreenZone: LandmarkRoute = {
  id: "lt5-green-zone",
  name: "Lecture Theatre 5 to the Green zone",
  from: "Lecture Theatre 5 (Level 1)",
  to: "the Green zone",
  checkpoints: [
    {
      id: "lt5",
      title: "Lecture Theatre 5",
      level: "Level 1",
      look: "The big white 5 on the blue circle, beside the theatre door.",
      instruction: "Face the Lecture Theatre 5 sign, then turn right and walk along the corridor to the blue GALLERY sign.",
      go: "right",
      image: photo("1-lt5"),
    },
    {
      id: "gallery",
      title: "Gallery sign",
      level: "Level 1",
      look: "Tall blue letters spelling GALLERY on a white wall.",
      instruction: "At the GALLERY sign, turn left and walk to the big blue ocean poster.",
      go: "left",
      image: photo("2-gallery"),
    },
    {
      id: "poster",
      title: "Ocean poster",
      level: "Level 1",
      look: "A large blue poster about plastic bottles, with a green exit sign to its right.",
      instruction: "At the ocean poster, turn right and follow the green exit sign into the emergency staircase.",
      go: "right",
      image: photo("3-poster"),
    },
    {
      id: "stair-1",
      title: "Staircase, Level 1",
      level: "Level 1",
      look: "A large black 1 painted on the staircase wall.",
      instruction: "You are in the emergency staircase on Level 1. Hold the handrail and walk down.",
      go: "down",
      image: photo("4-stair-1"),
    },
    {
      id: "stair-m",
      title: "Staircase, Mezzanine",
      level: "Mezzanine",
      look: "A large black M on the wall, green paint below it.",
      instruction: "Mezzanine. Do not leave the staircase here. Keep walking down, one more floor.",
      go: "down",
      image: photo("5-stair-m"),
    },
    {
      id: "stair-g",
      title: "Staircase, Ground",
      level: "Ground",
      look: "A large black G, and a grey double door with a green Exit to assembly point sign.",
      instruction: "Ground floor. Go straight through the grey double door marked Exit to assembly point.",
      go: "straight",
      image: photo("6-stair-g"),
    },
    {
      id: "exit-door",
      title: "Exit door",
      level: "Ground",
      look: "A grey door with a green Exit to assembly point sign and an arrow.",
      instruction: "Go straight through the door with the green Exit to assembly point sign.",
      go: "straight",
      image: photo("7-exit-door"),
    },
    {
      id: "green-zone",
      title: "Green zone",
      level: "Outside",
      look: "The open concourse with round pillars, looking out to the trees and the field.",
      instruction: "You have reached the Green zone. Stay here until the all clear.",
      go: "arrive",
      image: photo("8-green-zone"),
    },
  ],
};

export const landmarkRoutes = [lt5ToGreenZone];

export function getLandmarkRoute(id: string): LandmarkRoute | undefined {
  return landmarkRoutes.find((r) => r.id === id);
}

/** The address a checkpoint's QR code holds. Scanned with any camera app it opens the guide at that checkpoint. */
export function checkpointUrl(origin: string, route: LandmarkRoute, checkpoint: Checkpoint) {
  return `${origin.replace(/\/$/, "")}/guide/${route.id}?at=${checkpoint.id}`;
}

/** Which checkpoint of `route` a scanned QR code is for, or -1 if it is some other code. */
export function checkpointFromScan(route: LandmarkRoute, text: string): number {
  let url: URL;
  try {
    url = new URL(text, "https://safeway.invalid");
  } catch {
    return -1;
  }
  if (url.pathname.replace(/\/$/, "") !== `/guide/${route.id}`) return -1;
  return route.checkpoints.findIndex((c) => c.id === url.searchParams.get("at"));
}
