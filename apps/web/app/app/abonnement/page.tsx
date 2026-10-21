"use client";
import { useStudent } from "@/components/learning/student-shell";
import { Suspense } from "react";
import { BillingView } from "@/components/saas/billing-view";
export default function Page() {
  const user = useStudent();
  return (
    <Suspense>
      <BillingView user={user} />
    </Suspense>
  );
}
