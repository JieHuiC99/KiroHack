import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePageUser } from "@/lib/session";
import { VenueMonitor } from "./venue-monitor";

export const metadata: Metadata = { title: "SafeWay — Venue monitor" };

/** Reads the session, so it renders per request inside <Suspense>. The APIs check the role again. */
async function Gate() {
  const user = await requirePageUser("team");
  return <VenueMonitor user={user} />;
}

export default function Page() {
  return (
    <Suspense>
      <Gate />
    </Suspense>
  );
}
