import { auth } from "@/lib/auth";
import { roleFor, toProfile, type AppUser } from "@/lib/roles";
import type { Profile } from "@/lib/validation/emergency";

const PASSWORD = "integration-test-password";

/** A person as the services take them, without touching the auth tables. */
export function person(name: string, profile: Profile = "other", role: AppUser["role"] = "student"): AppUser {
  return { id: `test-${name.toLowerCase()}`, name, role, profile };
}

/**
 * A real Better Auth account and its session cookie, for calling route handlers the way a browser would.
 * The auth tables are not wiped between tests, so an account from an earlier run is signed in instead.
 */
export async function signedIn(email: string, name: string, profile: Profile = "other") {
  let response = await auth.api.signUpEmail({ body: { email, password: PASSWORD, name, profile }, asResponse: true });
  if (!response.ok) response = await auth.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
  if (!response.ok) throw new Error(`Could not sign in ${email}: ${response.status}`);
  const cookie = response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  const body = (await response.json()) as { user: { id: string; name: string; email: string; profile?: unknown } };
  const user: AppUser = { id: body.user.id, name: body.user.name, role: roleFor(body.user.email), profile: toProfile(body.user.profile) };
  return { user, cookie };
}

/** A request to a route handler, optionally as a signed-in person and/or with a classroom device key. */
export function request(options: { cookie?: string; deviceKey?: string; body?: unknown } = {}) {
  const headers = new Headers();
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.deviceKey) headers.set("x-safeway-device-key", options.deviceKey);
  return new Request("http://localhost:3100/api/test", {
    method: options.body === undefined ? "GET" : "POST",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}
