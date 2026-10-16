import type { Metadata } from "next";
import { DiagnosticForm } from "@/components/learning/diagnostic-form";
export const metadata: Metadata = { title: "Nouveau diagnostic" };
export default function Page() {
  return <DiagnosticForm />;
}
