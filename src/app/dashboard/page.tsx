import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePageUser } from "@/lib/session";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "SunSafe — Control dashboard" };

/** Reads the session, so it renders per request inside <Suspense>. The APIs check the role again. */
async function Gate() {
  const user = await requirePageUser("team");
  return <Dashboard user={user} />;
}

export default function Page() {
  return (
    <Suspense>
      <Gate />
    </Suspense>
  );
}
