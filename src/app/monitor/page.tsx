import type { Metadata } from "next";
import { VenueMonitor } from "./venue-monitor";

export const metadata: Metadata = { title: "SunSafe — Venue monitor" };

export default function MonitorPage() {
  return <VenueMonitor />;
}
