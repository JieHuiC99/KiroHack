import type { Metadata } from "next";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "SafeWay — Control dashboard" };

export default function DashboardPage() {
  return <Dashboard />;
}
