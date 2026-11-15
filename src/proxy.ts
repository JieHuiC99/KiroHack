// Next.js 16: proxy.ts replaces middleware.ts (exported function is `proxy`).
// Optimistic check only (cookie present?). Real checks happen in pages/actions via requireUser().
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

// Only guard app areas that need a user. Keep "/", "/sign-in", "/api/auth" public.
// Hackathon decision: /me, /responder and /dashboard are open for the demo (README "Decisions").
// To lock the dashboard down, add "/dashboard/:path*" here and requireUser() in src/server/emergency.ts.
export const config = { matcher: ["/admin/:path*"] };
