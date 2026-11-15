import { describe, expect, it } from "vitest";
import { homeFor, roleFor, SCREENS, toProfile } from "./roles";

const lists = { EMERGENCY_TEAM_EMAILS: "team@uni.test, Chief@Uni.test", RESPONDER_EMAILS: "ben@uni.test" };

describe("roleFor", () => {
  it("gives the team and responder roles only to listed addresses", () => {
    expect(roleFor("team@uni.test", lists)).toBe("team");
    expect(roleFor("ben@uni.test", lists)).toBe("responder");
    expect(roleFor("aisha@uni.test", lists)).toBe("student");
  });

  it("ignores case and spaces, and never matches part of an address", () => {
    expect(roleFor(" CHIEF@uni.test ", lists)).toBe("team");
    expect(roleFor("notteam@uni.test", lists)).toBe("student");
    expect(roleFor("team@uni.test.evil.example", lists)).toBe("student");
  });

  it("makes everyone a student when no lists are set", () => {
    expect(roleFor("team@uni.test", {})).toBe("student");
    expect(roleFor("", { EMERGENCY_TEAM_EMAILS: "" })).toBe("student");
  });
});

describe("toProfile", () => {
  it("keeps known profiles and falls back for anything else", () => {
    expect(toProfile("blind")).toBe("blind");
    expect(toProfile("wheelchair")).toBe("wheelchair");
    expect(toProfile("admin")).toBe("other");
    expect(toProfile(undefined)).toBe("other");
  });
});

describe("screens", () => {
  it("shows students only their own screen, and the team everything", () => {
    const visibleTo = (role: "student" | "responder" | "team") => SCREENS.filter((s) => s.roles.includes(role)).map((s) => s.href);
    expect(visibleTo("student")).toEqual(["/me", "/guide/lt5-green-zone"]);
    expect(visibleTo("responder")).toEqual(["/me", "/guide/lt5-green-zone", "/responder"]);
    expect(visibleTo("team")).toEqual(["/me", "/guide/lt5-green-zone", "/responder", "/dashboard", "/guide/lt5-green-zone/print", "/monitor"]);
  });

  it("sends each role to its own screen after sign-in", () => {
    expect([homeFor("student"), homeFor("responder"), homeFor("team")]).toEqual(["/me", "/responder", "/dashboard"]);
  });
});
