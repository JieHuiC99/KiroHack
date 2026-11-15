import type { Point, Turn } from "./types";

// Pure angle maths for the camera view: which way a route leg runs, which way the phone is facing,
// and the turn between the two. All angles are degrees clockwise from north, like a compass.

const DEG = Math.PI / 180;
const wrap360 = (degrees: number) => ((degrees % 360) + 360) % 360;

/** Direction of travel from one map point to the next. Map axes: x grows east, y grows south. */
export function mapBearing(from: Point, to: Point): number {
  return wrap360(Math.atan2(to.x - from.x, from.y - to.y) / DEG);
}

/**
 * Compass heading of the phone's back camera from a `deviceorientation` reading (W3C worked example).
 * Unlike plain `360 - alpha`, this stays right when the phone is held upright to look through the camera.
 */
export function compassHeading(alpha: number, beta: number, gamma: number): number {
  const [x, y, z] = [beta * DEG, gamma * DEG, alpha * DEG];
  const vx = -Math.cos(z) * Math.sin(y) - Math.sin(z) * Math.sin(x) * Math.cos(y);
  const vy = -Math.sin(z) * Math.sin(y) + Math.cos(z) * Math.sin(x) * Math.cos(y);
  return wrap360(Math.atan2(vx, vy) / DEG);
}

/** How far to turn to face `target` from `heading`: negative = left, positive = right, within ±180. */
export function relativeAngle(target: number, heading: number): number {
  return wrap360(target - heading + 180) - 180;
}

export function turnFor(angle: number): Turn {
  if (Math.abs(angle) <= 25) return "straight";
  if (Math.abs(angle) >= 150) return "back";
  return angle > 0 ? "right" : "left";
}

/** Blend a new compass reading into the last one, the short way round the circle, to stop the arrow jittering. */
export function smoothHeading(previous: number | null, next: number, weight = 0.25): number {
  if (previous === null) return wrap360(next);
  return wrap360(previous + relativeAngle(next, previous) * weight);
}
