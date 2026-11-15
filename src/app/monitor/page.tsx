import type { Metadata } from "next";
import { DEFAULT_USER } from "@/lib/default-user";
import { VenueMonitor } from "./venue-monitor";

export const metadata: Metadata = { title: "SunSafe — Venue monitor" };

export default function Page() {
  return <VenueMonitor user={DEFAULT_USER} />;
}
