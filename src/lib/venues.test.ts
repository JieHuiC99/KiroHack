import { describe, expect, it } from "vitest";
import { classAt, venueGroups, venues } from "./venues";

// 02:30 UTC = 10:30 in Malaysia, inside the 10:00 to 12:00 slot.
const midMorning = new Date("2026-11-16T02:30:00Z");

describe("venues", () => {
  it("has unique ids and covers every group the emergency team monitors", () => {
    expect(new Set(venues.map((v) => v.id)).size).toBe(venues.length);
    for (const group of venueGroups) expect(venues.some((v) => v.group === group)).toBe(true);
  });
});

describe("classAt (demo timetable, Malaysia time)", () => {
  it("has some rooms in use and some free during the day", () => {
    const inUse = venues.filter((v) => classAt(v.id, midMorning));
    expect(inUse.length).toBeGreaterThan(0);
    expect(inUse.length).toBeLessThan(venues.length);
  });

  it("reports the slot in local time and never more students than seats", () => {
    for (const venue of venues) {
      const session = classAt(venue.id, midMorning);
      if (!session) continue;
      expect(session).toMatchObject({ startsAt: "10:00", endsAt: "12:00" });
      expect(session.students).toBeGreaterThan(0);
      expect(session.students).toBeLessThanOrEqual(venue.seats);
    }
  });

  it("gives the same answer for the whole slot", () => {
    const later = new Date("2026-11-16T03:59:00Z");
    for (const venue of venues) expect(classAt(venue.id, later)).toEqual(classAt(venue.id, midMorning));
  });

  it("shows the 08:00 to 10:00 classes out of hours", () => {
    const night = new Date("2026-11-16T16:37:00Z"); // 00:37 in Malaysia, Tuesday
    const morning = new Date("2026-11-17T00:30:00Z"); // 08:30 the same Tuesday
    const late = venues.filter((v) => classAt(v.id, night));
    expect(late.length).toBeGreaterThan(0);
    for (const venue of venues) expect(classAt(venue.id, night)).toEqual(classAt(venue.id, morning));
    for (const venue of late) expect(classAt(venue.id, night)).toMatchObject({ startsAt: "08:00", endsAt: "10:00" });
  });

  it("has no classes in unknown rooms", () => {
    expect(classAt("nowhere", midMorning)).toBeNull();
  });
});
