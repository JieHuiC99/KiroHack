import type { Floor } from "./types";

/**
 * Sunway University building, Level 3 — traced by hand from a screenshot of the campus app map.
 *
 * ⚠ PROTOTYPE DATA. Shapes are approximate and the scale is a guess. The four corner blocks
 * drawn with stair lines in the app are assumed to be the fire staircases, and the larger
 * multi-cell blocks are assumed to be lifts. Check both against the evacuation plan posted on
 * the floor and confirm with the Health & Safety Office before anyone relies on a route.
 *
 * Units are screenshot pixels (x → right/east, y → down/south). Doors and junctions must sit
 * exactly on a walkway line, or the room can't be routed (routing.test.ts checks this).
 */
export const level3: Floor = {
  id: "uni-l3",
  building: "Sunway University",
  level: 3,
  label: "Level 3",
  transform: { scale: 1.62, dx: 71, dy: -598 },
  metresPerUnit: 0.25,
  assemblyPoint: "the assembly point on the field",

  corridors: [
    { x: 128, y: 375, w: 19, h: 295 }, // west wing
    { x: 147, y: 622, w: 290, h: 21 }, // central link
    { x: 147, y: 594, w: 35, h: 28 }, // lobby beside staircase B
    { x: 408, y: 406, w: 14, h: 254 }, // east wing
    { x: 422, y: 406, w: 53, h: 12 }, // east wing, north branch
    { x: 60, y: 650, w: 87, h: 20 }, // to the south-west staircase
    { x: 422, y: 638, w: 30, h: 20 }, // to the south-east staircase
  ],

  // Corridor centre lines. Doors and junctions must sit exactly on one of these.
  walkways: [
    { from: { x: 137, y: 385 }, to: { x: 137, y: 660 } },
    { from: { x: 137, y: 632 }, to: { x: 415, y: 632 } },
    { from: { x: 415, y: 412 }, to: { x: 415, y: 650 } },
    { from: { x: 415, y: 412 }, to: { x: 464, y: 412 } },
    { from: { x: 137, y: 660 }, to: { x: 70, y: 660 } },
    { from: { x: 415, y: 648 }, to: { x: 452, y: 648 } },
  ],

  rooms: [
    // West wing
    { id: "smls", name: "SMLS Researcher Room", kind: "room", x: 60, y: 375, w: 68, h: 43, door: { x: 137, y: 396 } },
    { id: "stair-nw", name: "North-west staircase", kind: "stairs", x: 60, y: 418, w: 68, h: 18, door: { x: 137, y: 427 } },
    { id: "biosafety", name: "Biosafety Lab", kind: "room", x: 60, y: 436, w: 68, h: 39, door: { x: 137, y: 455 } },
    { id: "pgr1", name: "Postgraduate Research Lab 1", kind: "room", x: 60, y: 475, w: 68, h: 39, door: { x: 137, y: 494 } },
    { id: "sbs-pg", name: "SBS Postgraduate Research Room", kind: "room", x: 60, y: 514, w: 68, h: 38, door: { x: 137, y: 533 } },
    { id: "w-office", name: "West wing office", kind: "office", x: 60, y: 552, w: 68, h: 40, door: { x: 137, y: 572 } },
    { id: "w-toilet", name: "Toilet (west)", kind: "toilet", x: 60, y: 592, w: 33, h: 41 },
    { id: "l3-lift-w", name: "", kind: "lift", x: 113, y: 592, w: 15, h: 56 },
    { id: "stair-sw", name: "South-west staircase", kind: "stairs", x: 60, y: 636, w: 22, h: 14, door: { x: 70, y: 660 } },
    { id: "home-lab", name: "H.O.M.E Lab", kind: "room", x: 60, y: 670, w: 85, h: 65, door: { x: 137, y: 660 } },

    // Central block
    { id: "l3-lift-c", name: "", kind: "lift", x: 155, y: 572, w: 20, h: 22 },
    { id: "c-n1", name: "Classroom (north 1)", kind: "room", x: 182, y: 572, w: 40, h: 50, door: { x: 202, y: 632 } },
    { id: "uc-3-3", name: "UC-3-3", kind: "room", x: 222, y: 572, w: 40, h: 50, door: { x: 242, y: 632 } },
    { id: "c-n3", name: "Classroom (north 3)", kind: "room", x: 262, y: 572, w: 38, h: 50, door: { x: 281, y: 632 } },
    { id: "uc-3-4", name: "UC-3-4", kind: "room", x: 300, y: 572, w: 40, h: 50, door: { x: 320, y: 632 } },
    { id: "c-n5", name: "Central office", kind: "office", x: 340, y: 572, w: 38, h: 50, door: { x: 359, y: 632 } },
    { id: "c-s1", name: "Classroom (south 1)", kind: "room", x: 182, y: 643, w: 40, h: 49, door: { x: 202, y: 632 } },
    { id: "uc-pl3-5", name: "UC-PL3-5", kind: "room", x: 222, y: 643, w: 78, h: 49, door: { x: 261, y: 632 } },
    { id: "uc-3-6", name: "UC-3-6", kind: "room", x: 300, y: 643, w: 40, h: 49, door: { x: 320, y: 632 } },
    { id: "c-s4", name: "Classroom (south 4)", kind: "room", x: 340, y: 643, w: 38, h: 49, door: { x: 359, y: 632 } },

    // East wing
    { id: "staff-n", name: "Academic Staffroom L3 (north)", kind: "office", x: 408, y: 378, w: 67, h: 28, door: { x: 440, y: 412 } },
    { id: "staff-w", name: "Academic Staffroom L3", kind: "office", x: 388, y: 378, w: 20, h: 218, door: { x: 415, y: 500 } },
    { id: "stair-ne", name: "North-east staircase", kind: "stairs", x: 454, y: 418, w: 21, h: 20, door: { x: 464, y: 412 } },
    { id: "staff-mid", name: "Academic Staffroom L3 (centre)", kind: "office", x: 422, y: 450, w: 24, h: 105, door: { x: 415, y: 520 } },
    { id: "staff-e", name: "Academic Staffroom L3 (east)", kind: "office", x: 454, y: 440, w: 21, h: 128 },
    { id: "meeting-2", name: "Meeting Room 2", kind: "room", x: 422, y: 568, w: 53, h: 24, door: { x: 415, y: 580 } },
    { id: "e-toilet", name: "Toilet (east)", kind: "toilet", x: 437, y: 596, w: 38, h: 40 },
    { id: "l3-lift-e", name: "", kind: "lift", x: 392, y: 600, w: 16, h: 22 },
    { id: "stair-se", name: "South-east staircase", kind: "stairs", x: 452, y: 638, w: 22, h: 15, door: { x: 452, y: 648 } },
    { id: "meeting-1", name: "Meeting Room 1", kind: "room", x: 388, y: 660, w: 62, h: 78, door: { x: 415, y: 650 } },
    { id: "e-office", name: "East wing office", kind: "office", x: 452, y: 655, w: 22, h: 75 },
  ],
};
