import { Suspense } from "react";
import { BillingView } from "@/components/saas/billing-view";
export default function Page() {
  return (
    <Suspense>
      <BillingView />
    </Suspense>
  );
}
