import type { Metadata } from "next";
import { CoursesView } from "@/components/learning/courses-view";
export const metadata: Metadata = { title: "Mes cours" };
export default function Page() {
  return <CoursesView />;
}
