import type { Metadata } from "next";
import { StudentHome } from "@/components/learning/student-home";
export const metadata: Metadata = { title: "Mon tableau de bord" };
export default function Student() {
  return <StudentHome />;
}
