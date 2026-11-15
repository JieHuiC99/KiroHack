import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { roleFor, toProfile, type AppUser, type Role } from "./roles";

/** Current session or null. Dynamic (reads headers) — call inside a <Suspense> boundary. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Session for route handlers: read it from the incoming request. */
export async function getRequestSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];

/** The signed-in person as the app sees them. The role is worked out here, on the server, every time. */
function toAppUser(user: SessionUser): AppUser {
  return { id: user.id, name: user.name, role: roleFor(user.email), profile: toProfile((user as { profile?: unknown }).profile) };
}

/** 401 = not signed in, 403 = signed in but not allowed. Turned into a JSON error by `handle()`. */
export class AuthError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? "Sign in first" : "You are not allowed to do this");
  }
}

/** The signed-in person, or null. For pages that look different signed in and out. */
export async function getAppUser(): Promise<AppUser | null> {
  const session = await getSession();
  return session ? toAppUser(session.user) : null;
}

/** For pages: sends people to sign in, or back home if their role may not open the page. No roles = any signed-in user. */
export async function requirePageUser(...allowed: Role[]): Promise<AppUser> {
  const user = await getAppUser();
  if (!user) redirect("/sign-in");
  if (allowed.length > 0 && !allowed.includes(user.role)) redirect("/?denied=1");
  return user;
}

/** For route handlers: throws AuthError. No roles = any signed-in user. */
export async function requireApiUser(request: Request, ...allowed: Role[]): Promise<AppUser> {
  const session = await getRequestSession(request);
  if (!session) throw new AuthError(401);
  const user = toAppUser(session.user);
  if (allowed.length > 0 && !allowed.includes(user.role)) throw new AuthError(403);
  return user;
}

export const DEVICE_KEY_HEADER = "x-safeway-device-key";
const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Classroom computers have nobody signed in, so they prove themselves with the shared device key
 * (CLASSROOM_DEVICE_KEY) instead. It only lets them read their room's alert and acknowledge it.
 */
export function isClassroomDevice(request: Request): boolean {
  const expected = process.env.CLASSROOM_DEVICE_KEY;
  const given = request.headers.get(DEVICE_KEY_HEADER);
  if (!expected || !given) return false;
  // Compare digests so the comparison takes the same time whatever was sent.
  return timingSafeEqual(digest(given), digest(expected));
}

/** A registered classroom computer, or a member of the emergency team. */
export async function requireDeviceOrTeam(request: Request) {
  if (!isClassroomDevice(request)) await requireApiUser(request, "team");
}

/** For pages/actions that need a signed-in user. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}
