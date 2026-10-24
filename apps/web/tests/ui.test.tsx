/* eslint-disable @next/next/no-img-element -- mock next/image in jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "../app/page";
import { Dashboard } from "../components/dashboard";
import { PublicNav } from "../components/public-nav";
import { DemoForm } from "../components/demo-form";
import {
  Input,
  Textarea,
  Select,
  Label,
  Separator,
  Skeleton,
  LoadingState,
  ErrorState,
  PageContainer,
} from "../components/ui";
import { Button } from "../components/ui/button";
import { cn } from "../components/ui/utils";
vi.mock("next/image", () => ({
  default: ({ src, alt, ...p }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img src={typeof src === "string" ? src : undefined} alt={alt} {...p} />
  ),
}));
describe("Navigation et fondations", () => {
  it("présente la méthode et les tarifs sans achat", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Apprends mieux",
    );
    expect(
      screen.getByRole("link", { name: "Découvrir Plus" }),
    ).toHaveAttribute("href", "/app/abonnement");
    expect(
      screen.getAllByRole("link", { name: "Créer mon compte gratuit" })[0],
    ).toHaveAttribute("href", "/inscription");
  });
  it("ouvre et ferme le menu par Escape et les liens", () => {
    render(<PublicNav />);
    const toggle = screen.getByRole("button", { name: "Ouvrir le menu" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(screen.getByRole("navigation"), { key: "Escape" });
    expect(toggle).toHaveFocus();
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("link", { name: "La méthode" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("link", { name: "Les matières" }));
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("link", { name: "Les offres" }));
  });
  it.each([false, true])("navigue dans le gabarit admin=%s", (admin) => {
    render(<Dashboard admin={admin} />);
    expect(
      screen.getByText(
        admin ? "Prototype administration" : "Bienvenue dans la démo",
        { exact: false },
      ),
    ).toBeVisible();
    const toggle = screen.getByRole("button", { name: "Ouvrir la navigation" });
    fireEvent.click(toggle);
    fireEvent.keyDown(screen.getByRole("complementary"), { key: "Escape" });
    expect(toggle).toHaveFocus();
    fireEvent.click(toggle);
    const nav = screen.getByRole("navigation");
    fireEvent.keyDown(nav, { key: "Tab" });
    fireEvent.click(
      screen.getByRole("button", {
        name: admin ? "Utilisateurs" : "Mes matières",
      }),
    );
    expect(screen.getByText(/Cette section est un gabarit/)).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Revenir à la vue générale" }),
    );
    expect(
      screen.getByText(
        admin ? "Activité de la plateforme" : "Mes révisions du jour",
      ),
    ).toBeVisible();
  });
  it("valide localement, annonce les erreurs puis le succès", async () => {
    render(<DemoForm />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByLabelText("Prénom")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Prénom"), {
      target: { value: "Emma" },
    });
    fireEvent.change(screen.getByLabelText("Objectif d’apprentissage"), {
      target: { value: "Comprendre les fonctions" },
    });
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "sans envoi de données",
      ),
    );
  });
  it("rend les états et composants accessibles", () => {
    render(
      <PageContainer>
        <Label htmlFor="test">Exemple</Label>
        <Input id="test" />
        <Select aria-label="Sélection">
          <option>Choix</option>
        </Select>
        <Textarea aria-label="Texte" />
        <Separator />
        <Skeleton />
        <LoadingState />
        <ErrorState />
        <Button variant="ghost">Action</Button>
      </PageContainer>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Le chargement a échoué",
    );
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
