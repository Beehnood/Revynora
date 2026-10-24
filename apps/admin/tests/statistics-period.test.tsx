import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminView } from "../components/admin-view";
const calls = vi.hoisted(() => [] as string[]);
vi.mock("../lib/use-resource", () => ({
  useResource: (path: string) => {
    calls.push(path);
    return { data: null, error: "", loading: false, reload: vi.fn() };
  },
}));
it("n'applique la période valide qu'à la soumission et remet la pagination à zéro", () => {
  calls.length = 0;
  render(<AdminView />);
  fireEvent.change(screen.getByLabelText("Du"), {
    target: { value: "2026-02-01" },
  });
  fireEvent.change(screen.getByLabelText("Au (exclu)"), {
    target: { value: "2026-02-05" },
  });
  expect(
    calls.filter((p) => p.startsWith("/admin/statistics")).at(-1),
  ).not.toContain("from=2026-02-01");
  fireEvent.click(screen.getByRole("button", { name: "Appliquer la période" }));
  expect(calls.filter((p) => p.startsWith("/admin/statistics")).at(-1)).toBe(
    "/admin/statistics?from=2026-02-01&to=2026-02-05",
  );
  fireEvent.change(screen.getByLabelText("Au (exclu)"), {
    target: { value: "2026-01-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Appliquer la période" }));
  expect(screen.getByRole("alert")).toHaveTextContent("1 à 366 jours UTC");
  expect(
    calls.filter((p) => p.startsWith("/admin/statistics")).at(-1),
  ).toContain("to=2026-02-05");
});
