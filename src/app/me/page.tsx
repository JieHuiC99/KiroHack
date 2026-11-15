import type { Metadata } from "next";
import { DEFAULT_USER } from "@/lib/default-user";
import { StudentApp } from "./student-app";

export const metadata: Metadata = { title: "SunSafe — My evacuation" };

export default function Page() {
  return <StudentApp user={DEFAULT_USER} />;
}
