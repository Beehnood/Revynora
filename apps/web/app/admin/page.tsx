import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
export const metadata: Metadata = {
  title: "Administration — Prototype",
  robots: { index: false, follow: false },
};
export default function Admin() {
  return <Dashboard admin />;
}
