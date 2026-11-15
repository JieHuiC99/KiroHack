import type { Metadata } from "next";
import { WayOutScreen } from "./way-out-screen";

export const metadata: Metadata = { title: "SunSafe — Your way out" };

export default function RoutePage() {
  return <WayOutScreen />;
}
