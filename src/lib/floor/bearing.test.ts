import { describe, expect, it } from "vitest";
import { compassHeading, mapBearing, relativeAngle, smoothHeading, turnFor } from "./bearing";

describe("mapBearing (x east, y south)", () => {
  const here = { x: 100, y: 100 };
  it("reads like a compass", () => {
    expect(mapBearing(here, { x: 100, y: 50 })).toBeCloseTo(0); // up the map = north
    expect(mapBearing(here, { x: 150, y: 100 })).toBeCloseTo(90); // east
    expect(mapBearing(here, { x: 100, y: 150 })).toBeCloseTo(180); // south
    expect(mapBearing(here, { x: 50, y: 100 })).toBeCloseTo(270); // west
  });
});

describe("compassHeading (phone held upright, looking through the back camera)", () => {
  // beta = 90: the phone is vertical. alpha then turns it about the vertical axis, counter-clockwise.
  it("follows the phone as it turns", () => {
    expect(compassHeading(0, 90, 0)).toBeCloseTo(0);
    expect(compassHeading(270, 90, 0)).toBeCloseTo(90); // turned a quarter clockwise = facing east
    expect(compassHeading(180, 90, 0)).toBeCloseTo(180);
    expect(compassHeading(90, 90, 0)).toBeCloseTo(270);
  });

  it("is steady when the phone is tilted back a little", () => {
    expect(compassHeading(270, 60, 0)).toBeCloseTo(90);
    expect(compassHeading(270, 110, 0)).toBeCloseTo(90);
  });
});

describe("relativeAngle and turnFor", () => {
  it("takes the short way round", () => {
    expect(relativeAngle(10, 350)).toBeCloseTo(20);
    expect(relativeAngle(350, 10)).toBeCloseTo(-20);
    expect(relativeAngle(180, 0)).toBeCloseTo(-180);
  });

  it("names the turn", () => {
    expect(turnFor(0)).toBe("straight");
    expect(turnFor(-20)).toBe("straight");
    expect(turnFor(90)).toBe("right");
    expect(turnFor(-90)).toBe("left");
    expect(turnFor(170)).toBe("back");
  });
});

describe("smoothHeading", () => {
  it("starts at the first reading and then moves part of the way", () => {
    expect(smoothHeading(null, 40)).toBe(40);
    expect(smoothHeading(40, 80, 0.25)).toBeCloseTo(50);
  });

  it("crosses north without swinging the long way round", () => {
    expect(smoothHeading(350, 10, 0.5)).toBeCloseTo(0);
  });
});
