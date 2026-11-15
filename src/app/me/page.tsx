import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePageUser } from "@/lib/session";
import { StudentApp } from "./student-app";

export const metadata: Metadata = { title: "SunSafe — My evacuation" };

/** Reads the session, so it renders per request inside <Suspense>. The APIs check the role again. */
async function Gate() {
  const user = await requirePageUser();
  return <StudentApp user={user} />;
}

export default function Page() {
  return (
    <Suspense>
      <Gate />
    </Suspense>
  );
}
