// Teaching venues and who is in them right now. Pure: shared by the server, the monitor and the classroom screen.
//
// ⚠ DEMO DATA. The venue names come from the campus map, but the timetable below is generated, not real
// (classes from 08:00 to 22:00, a few late sessions overnight so the monitor is never empty in a demo):
// swap `classAt` for a lookup in the university timetable system before real use.

export const venueGroups = ["UC", "UE", "UW", "Lecture Theatre", "JC"] as const;
export type VenueGroup = (typeof venueGroups)[number];

export type Venue = { id: string; name: string; group: VenueGroup; level: string; seats: number };

export const venues: Venue[] = [
  { id: "uc-3-3", name: "UC-3-3", group: "UC", level: "Level 3", seats: 40 },
  { id: "uc-3-4", name: "UC-3-4", group: "UC", level: "Level 3", seats: 40 },
  { id: "uc-pl3-5", name: "UC-PL3-5", group: "UC", level: "Level 3", seats: 60 },
  { id: "uc-3-6", name: "UC-3-6", group: "UC", level: "Level 3", seats: 40 },
  { id: "ue-2-15", name: "UE-2-15", group: "UE", level: "Level 2", seats: 35 },
  { id: "ue-2-16", name: "UE-2-16", group: "UE", level: "Level 2", seats: 35 },
  { id: "ue-2-17", name: "UE-2-17", group: "UE", level: "Level 2", seats: 35 },
  { id: "uw-2-2", name: "UW-2-2", group: "UW", level: "Level 2", seats: 60 },
  { id: "uw-2-3", name: "UW-2-3", group: "UW", level: "Level 2", seats: 30 },
  { id: "uw-2-4", name: "UW-2-4", group: "UW", level: "Level 2", seats: 30 },
  { id: "uw-2-5", name: "UW-2-5", group: "UW", level: "Level 2", seats: 30 },
  { id: "uw-2-7", name: "UW-2-7", group: "UW", level: "Level 2", seats: 45 },
  { id: "lt-3", name: "Uni Lecture Theatre 3", group: "Lecture Theatre", level: "Ground", seats: 120 },
  { id: "lt-4", name: "Uni Lecture Theatre 4", group: "Lecture Theatre", level: "Ground", seats: 120 },
  { id: "lt-5", name: "Uni Lecture Theatre 5", group: "Lecture Theatre", level: "Level 1", seats: 150 },
  { id: "lt-6", name: "Uni Lecture Theatre 6", group: "Lecture Theatre", level: "Level 1", seats: 150 },
  { id: "lt-7", name: "Uni Lecture Theatre 7", group: "Lecture Theatre", level: "Level 1", seats: 100 },
  { id: "lt-8", name: "Uni Lecture Theatre 8", group: "Lecture Theatre", level: "Level 1", seats: 100 },
  { id: "jc-1", name: "JC 1", group: "JC", level: "Level 1", seats: 400 },
  { id: "jc-2", name: "JC 2", group: "JC", level: "Level 1", seats: 200 },
  { id: "jc-3", name: "JC 3", group: "JC", level: "Level 1", seats: 200 },
];

export function getVenue(id: string): Venue | undefined {
  return venues.find((v) => v.id === id);
}

export type ClassSession = {
  code: string;
  title: string;
  lecturer: string;
  students: number;
  /** Local (Malaysia) clock times, "HH:MM". */
  startsAt: string;
  endsAt: string;
};

const COURSES: [code: string, title: string, lecturer: string][] = [
  ["CSC1024", "Programming Principles", "Dr Lim"],
  ["MTH1114", "Computer Mathematics", "Dr Farah"],
  ["NET1014", "Networking Principles", "Mr Raj"],
  ["SEG2202", "Software Engineering", "Dr Tan"],
  ["BIO1034", "Cell Biology", "Dr Nurul"],
  ["ACC1013", "Financial Accounting", "Ms Wong"],
  ["PSY1014", "Introduction to Psychology", "Dr Kavitha"],
  ["ENG1044", "Academic English", "Ms Chong"],
  ["MKT2014", "Consumer Behaviour", "Mr Daniel"],
  ["CSC2103", "Data Structures and Algorithms", "Dr Ahmad"],
  ["STA1023", "Statistics for Science", "Dr Lee"],
  ["ART1004", "Design Studio", "Ms Aina"],
];

/** Out-of-hours bookings: smaller groups, so the monitor still shows a believable mix at night. */
const LATE_SESSIONS: [code: string, title: string, lecturer: string][] = [
  ["REV-CS", "Exam revision clinic: Computing", "Ms Tan"],
  ["LAB-BIO", "Research lab session", "Dr Nurul"],
  ["CLUB-ROB", "Robotics club build night", "Mr Hafiz"],
  ["HACK", "Student hackathon", "Mr Daniel"],
  ["REV-MTH", "Exam revision clinic: Mathematics", "Dr Farah"],
  ["PG-SEM", "Postgraduate seminar", "Dr Lee"],
  ["DES-STU", "Design studio open hours", "Ms Aina"],
];

const FIRST_HOUR = 8;
const SLOT_HOURS = 2;
const SLOTS_PER_DAY = 7; // 08:00 to 22:00
const MALAYSIA_OFFSET_HOURS = 8; // no daylight saving
const clock = (hour: number) => `${String(hour % 24).padStart(2, "0")}:00`;

/** The class in a venue at a moment in time, or null if the room is free. */
export function classAt(venueId: string, now: Date): ClassSession | null {
  const index = venues.findIndex((v) => v.id === venueId);
  if (index === -1) return null;
  const local = new Date(now.getTime() + MALAYSIA_OFFSET_HOURS * 3_600_000);
  const hour = local.getUTCHours();
  const day = local.getUTCDay();
  const seats = venues[index].seats;

  const slot = Math.floor((hour - FIRST_HOUR) / SLOT_HOURS);
  if (slot >= 0 && slot < SLOTS_PER_DAY) {
    // Teaching hours. Generated pattern: about two rooms in three are in use in any slot, and it differs by day.
    const pick = index * 7 + slot * 3 + day * 5;
    if (pick % 3 === 0) return null;
    const [code, title, lecturer] = COURSES[pick % COURSES.length];
    const start = FIRST_HOUR + slot * SLOT_HOURS;
    return { code, title, lecturer, students: Math.round(seats * (0.45 + ((pick * 13) % 50) / 100)), startsAt: clock(start), endsAt: clock(start + SLOT_HOURS) };
  }

  // Out of hours (22:00 to 08:00): about one room in three has a late session, with a small group.
  const block = Math.floor(hour / SLOT_HOURS);
  const pick = index * 5 + block * 7 + day * 3;
  if (pick % 3 !== 0) return null;
  const [code, title, lecturer] = LATE_SESSIONS[pick % LATE_SESSIONS.length];
  const start = block * SLOT_HOURS;
  return { code, title, lecturer, students: Math.max(4, Math.round(seats * (0.12 + ((pick * 11) % 30) / 100))), startsAt: clock(start), endsAt: clock(start + SLOT_HOURS) };
}
