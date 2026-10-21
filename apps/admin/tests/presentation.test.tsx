import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { money, dateLabel, label } from "../lib/presentation";
import { RegistrationChart } from "../modules/statistics/registration-chart";
it("affiche les euros sans perte de précision et ne suppose pas l’échelle des autres devises", () => {
  expect(money("250", "eur")).toBe("2,50 €");
  expect(money("9007199254740993123", "EUR")).toBe("90071992547409931,23 €");
  expect(money("-5", "eur")).toBe("−0,05 €");
  expect(money("250", "jpy")).toBe(
    "250 unités stockées (échelle non vérifiée) JPY",
  );
  expect(dateLabel("2026-01-01T23:30:00Z")).toContain("23:30 UTC");
  expect(dateLabel("2026-01-01", false)).toBe("01/01/2026");
  expect(dateLabel("invalid")).toBe("Date indisponible");
  expect(label("PAID")).toBe("Marqué payé");
  expect(label("future")).toBe("future");
});
it("annote une seule journée et conserve les valeurs et le nom accessible du graphique", () => {
  const { container } = render(
    <RegistrationChart
      rows={[{ date: "2026-01-01", count: 2 }]}
      max={2}
      total={2}
    />,
  );
  expect(
    screen.getByRole("img", { name: "Inscriptions quotidiennes" }),
  ).toBeVisible();
  expect(screen.getByText("Maximum : 2 / jour")).toBeVisible();
  expect(screen.getByText("01/01/2026")).toBeVisible();
  expect(container.querySelectorAll("rect")).toHaveLength(1);
});
