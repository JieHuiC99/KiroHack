import type { Metadata } from "next";
import { DEFAULT_USER } from "@/lib/default-user";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "SunSafe — Control dashboard" };

export default function Page() {
  return <Dashboard user={DEFAULT_USER} />;
}
