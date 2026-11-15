import type { Floor, Rect, Room, RoomKind } from "./types";

/**
 * Ground, Mezzanine, Level 1 and Level 2 of the Sunway University building, traced by hand from
 * screenshots of the campus app.
 *
 * ⚠ PROTOTYPE DATA, drawn for the 3D model only: these floors have no doors or walkways yet, so
 * people can't pick a room on them. To make a floor routable, give its rooms `door` points and
 * add `walkways`, the way level3.ts does.
 *
 * The ground-floor walks from each staircase to the field (`groundExits`) are GUESSES: the app
 * map does not show where the fire staircases come out or where the exit doors are.
 */

const BUILDING = "Sunway University";
const ASSEMBLY = "the assembly point on the field";

let nextId = 0;
const block = (kind: RoomKind, name: string, x: number, y: number, w: number, h: number): Room => ({
  id: `block-${nextId++}`,
  name,
  kind,
  x,
  y,
  w,
  h,
});
const room = (name: string, x: number, y: number, w: number, h: number) => block("room", name, x, y, w, h);
const office = (x: number, y: number, w: number, h: number) => block("office", "", x, y, w, h);
const toilet = (x: number, y: number, w: number, h: number) => block("toilet", "", x, y, w, h);
const lift = (x: number, y: number, w: number, h: number) => block("lift", "", x, y, w, h);

/** The four corner staircases keep the same id on every floor, so the model can join them up. */
function stairs(nw: Rect, sw: Rect, ne: Rect, se: Rect): Room[] {
  return [
    { id: "stair-nw", name: "North-west staircase", kind: "stairs", ...nw },
    { id: "stair-sw", name: "South-west staircase", kind: "stairs", ...sw },
    { id: "stair-ne", name: "North-east staircase", kind: "stairs", ...ne },
    { id: "stair-se", name: "South-east staircase", kind: "stairs", ...se },
  ];
}
const box = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export const ground: Floor = {
  id: "uni-g",
  building: BUILDING,
  level: 0,
  label: "Ground",
  transform: { scale: 1.185, dx: -50, dy: -21 },
  metresPerUnit: 0.18,
  assemblyPoint: ASSEMBLY,
  walkways: [],
  field: box(398, 583, 206, 259),
  corridors: [
    box(145, 40, 41, 290), // walkway from Side Gate 3
    box(277, 88, 333, 412), // main concourse
    box(218, 330, 59, 82),
    box(145, 412, 210, 156),
    box(610, 300, 55, 200),
    box(665, 383, 85, 45),
    box(630, 455, 75, 70),
  ],
  rooms: [
    room("Uni Lecture Theatre 4", 186, 117, 91, 53),
    room("Uni Lecture Theatre 3", 186, 170, 91, 52),
    room("", 186, 222, 91, 54),
    room("", 186, 276, 91, 54),
    room("", 320, 122, 72, 58),
    room("", 465, 225, 95, 150),
    room("Library", 610, 113, 190, 187),
    room("Security", 658, 47, 92, 43),
    room("Career Hub", 665, 428, 85, 57),
    room("Fresco", 410, 440, 48, 48),
    office(257, 442, 40, 40),
    office(305, 442, 40, 40),
    office(193, 425, 22, 20),
    office(193, 462, 22, 40),
    toilet(700, 328, 50, 55),
    lift(261, 330, 20, 82),
    lift(660, 348, 20, 62),
    lift(318, 302, 20, 28),
    ...stairs(box(170, 93, 30, 22), box(186, 388, 30, 22), box(720, 90, 30, 22), box(722, 385, 30, 22)),
  ],
  groundExits: {
    "stair-sw": [
      { x: 201, y: 399 },
      { x: 201, y: 418 },
      { x: 500, y: 418 },
      { x: 500, y: 640 },
    ],
    "stair-se": [
      { x: 737, y: 396 },
      { x: 737, y: 418 },
      { x: 500, y: 418 },
      { x: 500, y: 640 },
    ],
    "stair-nw": [
      { x: 185, y: 104 },
      { x: 165, y: 104 },
      { x: 165, y: 50 },
      { x: 125, y: 50 },
      { x: 125, y: 640 },
      { x: 500, y: 640 },
    ],
    "stair-ne": [
      { x: 735, y: 101 },
      { x: 820, y: 101 },
      { x: 820, y: 640 },
      { x: 500, y: 640 },
    ],
  },
};

export const mezzanine: Floor = {
  id: "uni-m",
  building: BUILDING,
  level: 1,
  label: "Mezzanine",
  transform: { scale: 1, dx: 37, dy: -17 },
  metresPerUnit: 0.154,
  assemblyPoint: ASSEMBLY,
  walkways: [],
  corridors: [
    box(75, 35, 192, 380),
    box(267, 350, 62, 135),
    box(182, 415, 95, 85),
    box(337, 500, 297, 95),
    box(664, 97, 75, 93),
    box(585, 350, 165, 160),
    box(650, 510, 100, 115),
    box(750, 553, 330, 20), // link bridge
  ],
  rooms: [
    room("Prayer Room (Female)", 75, 35, 166, 60),
    room("", 95, 126, 145, 62),
    room("", 95, 188, 145, 64),
    room("", 95, 252, 145, 64),
    room("", 95, 316, 145, 64),
    room("Prayer Room (Male)", 198, 500, 131, 104),
    room("", 135, 604, 194, 63),
    room("Gallery", 350, 570, 270, 100),
    room("", 664, 25, 141, 72),
    room("", 738, 128, 128, 62),
    room("Campus Library", 637, 190, 229, 193),
    room("Starbucks", 695, 483, 108, 45),
    office(127, 415, 55, 32),
    office(135, 547, 52, 30),
    toilet(135, 478, 47, 69),
    toilet(743, 384, 60, 66),
    lift(217, 381, 24, 98),
    lift(694, 409, 23, 73),
    lift(286, 349, 24, 34),
    ...stairs(box(112, 99, 34, 23), box(127, 453, 34, 23), box(770, 101, 34, 23), box(769, 455, 34, 23)),
  ],
};

export const level1: Floor = {
  id: "uni-l1",
  building: BUILDING,
  level: 2,
  label: "Level 1",
  transform: { scale: 1, dx: 0, dy: 0 },
  metresPerUnit: 0.154,
  assemblyPoint: ASSEMBLY,
  walkways: [],
  corridors: [
    box(118, 20, 190, 348),
    box(225, 345, 560, 120), // pre-function area
    box(380, 465, 295, 112),
    box(702, 12, 140, 100),
    box(675, 112, 227, 235),
    box(695, 505, 92, 95),
  ],
  rooms: [
    room("Function Room 2", 118, 22, 160, 63),
    room("Film Shooting Studio", 138, 114, 140, 62),
    room("Uni Lecture Theatre 6", 138, 176, 140, 63),
    room("Uni Lecture Theatre 5", 138, 239, 140, 62),
    room("JC 1", 410, 130, 190, 215),
    room("Art Gallery", 170, 465, 201, 122),
    room("", 179, 587, 192, 64),
    room("JC 3", 392, 484, 129, 168),
    room("JC 2", 534, 484, 127, 168),
    room("Function Room 3", 730, 12, 111, 72),
    room("Uni Lecture Theatre 8", 770, 113, 71, 125),
    room("Uni Lecture Theatre 7", 770, 238, 71, 127),
    room("Chancellor's Suite", 740, 465, 101, 90),
    office(138, 301, 140, 43),
    toilet(170, 367, 54, 66),
    toilet(781, 366, 60, 67),
    lift(259, 367, 24, 98),
    lift(733, 392, 22, 73),
    lift(320, 334, 32, 34),
    ...stairs(box(153, 88, 34, 22), box(170, 438, 34, 23), box(807, 86, 33, 22), box(807, 437, 33, 23)),
  ],
};

export const level2: Floor = {
  id: "uni-l2",
  building: BUILDING,
  level: 3,
  label: "Level 2",
  transform: { scale: 1, dx: -7, dy: 4 },
  metresPerUnit: 0.154,
  assemblyPoint: ASSEMBLY,
  walkways: [],
  corridors: [box(177, 10, 138, 575), box(315, 330, 61, 255), box(709, 8, 138, 590), box(691, 388, 20, 72)],
  rooms: [
    room("UW-2-7", 177, 10, 72, 70),
    room("", 250, 10, 65, 98),
    room("", 177, 110, 52, 62),
    room("", 250, 108, 65, 64),
    room("UW-2-5", 177, 172, 52, 62),
    room("", 250, 172, 65, 62),
    room("UW-2-4", 177, 234, 52, 62),
    room("", 265, 234, 50, 63),
    room("", 177, 296, 52, 66),
    room("UW-2-3", 177, 460, 44, 55),
    room("UW-2-2", 177, 515, 138, 70),
    room("", 709, 8, 62, 100),
    room("", 772, 8, 75, 72),
    room("", 709, 110, 62, 62),
    room("UE-2-15", 789, 110, 58, 62),
    room("", 709, 172, 62, 62),
    room("UE-2-16", 789, 172, 58, 62),
    room("", 709, 234, 62, 62),
    room("UE-2-17", 789, 234, 58, 62),
    room("", 789, 296, 58, 66),
    room("Postgraduate Research Workspace", 709, 460, 62, 80),
    room("", 772, 460, 75, 58),
    room("", 709, 540, 62, 57),
    room("", 772, 518, 75, 79),
    office(250, 297, 65, 47),
    toilet(177, 363, 53, 67),
    toilet(788, 362, 59, 68),
    lift(265, 363, 25, 98),
    lift(739, 388, 23, 72),
    lift(333, 332, 24, 33),
    ...stairs(box(160, 84, 34, 24), box(177, 435, 34, 23), box(813, 83, 34, 23), box(813, 434, 34, 23)),
  ],
};
