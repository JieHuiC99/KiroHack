import type { Metadata } from "next";
import { DEFAULT_USER } from "@/lib/default-user";
import { ResponderApp } from "./responder-app";

export const metadata: Metadata = { title: "SunSafe — Responder" };

export default function Page() {
  return <ResponderApp user={DEFAULT_USER} />;
}
