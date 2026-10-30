import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PaymentsPage from "../app/admin/paiements/page";
import SubscriptionsPage from "../app/admin/abonnements/page";
vi.mock("../lib/use-resource", () => ({
  useResource: () => ({
    data: null,
    error: "",
    loading: false,
    reload: vi.fn(),
  }),
}));
it("branche la consultation des paiements", () => {
  render(<PaymentsPage />);
  expect(screen.getByRole("heading", { name: "Paiements" })).toBeVisible();
});
it("branche la consultation des abonnements", () => {
  render(<SubscriptionsPage />);
  expect(screen.getByRole("heading", { name: "Abonnements" })).toBeVisible();
});
