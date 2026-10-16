import type { Metadata } from "next";
import { HistoryView } from "@/components/learning/history-view";
export const metadata: Metadata = { title: "Mes tests" };
export default function Page() {
  return <HistoryView />;
}
