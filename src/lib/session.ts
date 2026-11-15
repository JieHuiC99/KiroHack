import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/** Current session or null. Dynamic (reads headers) — call inside a <Suspense> boundary. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Session for route handlers: read it from the incoming request. */
export async function getRequestSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}

/** For pages/actions that need a signed-in user. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}
