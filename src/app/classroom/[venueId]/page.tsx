import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getVenue, venues } from "@/lib/venues";
import { ClassroomAlert } from "./classroom-alert";

export const metadata: Metadata = { title: "SafeWay — Classroom alert" };

export function generateStaticParams() {
  return venues.map((venue) => ({ venueId: venue.id }));
}

async function Screen({ params }: { params: PageProps<"/classroom/[venueId]">["params"] }) {
  const { venueId } = await params;
  const venue = getVenue(venueId);
  if (!venue) notFound();
  return <ClassroomAlert venue={venue} />;
}

export default function ClassroomPage({ params }: PageProps<"/classroom/[venueId]">) {
  return (
    <Suspense>
      <Screen params={params} />
    </Suspense>
  );
}
