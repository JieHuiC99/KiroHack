import type { Metadata } from "next";
import { ResponderApp } from "./responder-app";

export const metadata: Metadata = { title: "SafeWay — Responder" };

export default function ResponderPage() {
  return <ResponderApp />;
}
