import { AttemptView } from "@/components/learning/attempt-view";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Mon diagnostic" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AttemptView id={id} />;
}
