import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePageUser } from "@/lib/session";
import { ResponderApp } from "./responder-app";

export const metadata: Metadata = { title: "SafeWay — Responder" };

/** Reads the session, so it renders per request inside <Suspense>. The APIs check the role again. */
async function Gate() {
  const user = await requirePageUser("responder", "team");
  return <ResponderApp user={user} />;
}

export default function Page() {
  return (
    <Suspense>
      <Gate />
    </Suspense>
  );
}
