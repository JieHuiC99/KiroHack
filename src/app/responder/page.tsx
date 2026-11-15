import type { Metadata } from "next";
import { ResponderApp } from "./responder-app";

export const metadata: Metadata = { title: "SunSafe — Responder" };

export default function ResponderPage() {
  return <ResponderApp />;
}
