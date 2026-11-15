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

// Only guard app areas that need a user. Keep "/", "/sign-in", "/api/auth" and "/classroom" public
// (classroom computers have nobody signed in; they use the device key instead).
// This is only the quick redirect. Who may open what is checked in each page (requirePageUser) and each API route.
export const config = { matcher: ["/me/:path*", "/guide/:path*", "/responder/:path*", "/dashboard/:path*", "/monitor/:path*"] };
