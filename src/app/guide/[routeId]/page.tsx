import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLandmarkRoute } from "@/lib/landmark-routes";
import { DEFAULT_USER } from "@/lib/default-user";
import { LandmarkGuide } from "./landmark-guide";

export const metadata: Metadata = { title: "SafeWay — Camera route" };

/** A wall QR code opens the route at ?at=<checkpoint>. */
async function Gate({ params, searchParams }: PageProps<"/guide/[routeId]">) {
  const [{ routeId }, query] = await Promise.all([params, searchParams]);
  const route = getLandmarkRoute(routeId);
  if (!route) notFound();
  const user = DEFAULT_USER;
  const at = route.checkpoints.findIndex((c) => c.id === query.at);
  // Keyed by the checkpoint so scanning another wall code with the phone's own camera starts from there.
  return <LandmarkGuide key={at} route={route} user={user} startAt={Math.max(at, 0)} />;
}

export default function GuidePage(props: PageProps<"/guide/[routeId]">) {
  return (
    <Suspense>
      <Gate {...props} />
    </Suspense>
  );
}
