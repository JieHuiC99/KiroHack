import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkpointFromScan, checkpointUrl, getLandmarkRoute, landmarkRoutes, lt5ToGreenZone as route } from "./landmark-routes";

describe("landmark routes", () => {
  it("have unique checkpoint ids, a photo for each, and end with an arrival", () => {
    for (const r of landmarkRoutes) {
      const ids = r.checkpoints.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const c of r.checkpoints) expect(existsSync(`public${c.image}`), c.image).toBe(true);
      expect(r.checkpoints.at(-1)!.go).toBe("arrive");
      expect(r.checkpoints.slice(0, -1).some((c) => c.go === "arrive")).toBe(false);
    }
    expect(getLandmarkRoute("lt5-green-zone")).toBe(route);
    expect(getLandmarkRoute("nowhere")).toBeUndefined();
  });

  it("goes from Lecture Theatre 5 down the staircase floor by floor to the Green zone", () => {
    expect(route.checkpoints.map((c) => [c.id, c.go])).toEqual([
      ["lt5", "right"],
      ["gallery", "left"],
      ["poster", "right"],
      ["stair-1", "down"],
      ["stair-m", "down"],
      ["stair-g", "straight"],
      ["exit-door", "straight"],
      ["green-zone", "arrive"],
    ]);
  });
});

describe("checkpoint QR codes", () => {
  const origin = "https://safeway.example.com/";

  it("round-trip: the address on the wall leads back to its checkpoint", () => {
    route.checkpoints.forEach((checkpoint, index) => {
      const url = checkpointUrl(origin, route, checkpoint);
      expect(url).toBe(`https://safeway.example.com/guide/lt5-green-zone?at=${checkpoint.id}`);
      expect(checkpointFromScan(route, url)).toBe(index);
    });
  });

  it("works whatever address the app is served from", () => {
    expect(checkpointFromScan(route, "http://localhost:3000/guide/lt5-green-zone?at=poster")).toBe(2);
    expect(checkpointFromScan(route, "/guide/lt5-green-zone/?at=stair-m")).toBe(4);
  });

  it("ignores codes that are not for this route", () => {
    expect(checkpointFromScan(route, "https://safeway.example.com/guide/other-route?at=poster")).toBe(-1);
    expect(checkpointFromScan(route, "https://safeway.example.com/guide/lt5-green-zone?at=roof")).toBe(-1);
    expect(checkpointFromScan(route, "https://example.com/menu.pdf")).toBe(-1);
    expect(checkpointFromScan(route, "WIFI:S:Campus;;")).toBe(-1);
    expect(checkpointFromScan(route, "")).toBe(-1);
  });
});
