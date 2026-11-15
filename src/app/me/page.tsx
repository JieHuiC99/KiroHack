import type { Metadata } from "next";
import { StudentApp } from "./student-app";

export const metadata: Metadata = { title: "SafeWay — My evacuation" };

export default function MePage() {
  return <StudentApp />;
}
