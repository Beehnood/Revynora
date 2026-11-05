import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PdfLibrary } from "../components/learning/pdf-library";
const state = vi.hoisted(() => ({
  available: true,
  items: [] as Record<string, unknown>[],
  reload: vi.fn(),
  request: vi.fn(),
}));
vi.mock("@/lib/use-resource", () => ({
  useResource: (path: string) => ({
    loading: false,
    error: "",
    reload: state.reload,
    data: path.includes("/config")
      ? {
          available: state.available,
          weeklyLimit: 3,
          used: 0,
          resetAt: "2026-11-09T00:00:00Z",
        }
      : { items: state.items, total: state.items.length },
  }),
}));
vi.mock("@/lib/api", () => ({
  api: state.request,
  message: (e: Error) => e.message,
}));
beforeEach(() => {
  state.available = true;
  state.items = [];
  state.reload.mockClear();
  state.request.mockReset();
});
it("annonce une IA indisponible sans synthèse simulée ni matière obligatoire", () => {
  state.available = false;
  render(<PdfLibrary />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "aucun fournisseur réel",
  );
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByText("Notions maîtrisées")).not.toBeInTheDocument();
});
it("importe un vrai fichier par multipart puis présente une action distincte d’analyse", async () => {
  render(<PdfLibrary />);
  const file = new File(
    ["%PDF-1.7\nsynthetic test fixture\n%%EOF"],
    "cours.pdf",
    { type: "application/pdf" },
  );
  state.request.mockResolvedValue({ id: "one" });
  fireEvent.change(screen.getByLabelText("Mon document PDF"), {
    target: { files: [file] },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Importer mon PDF" }).closest("form")!,
  );
  await waitFor(() => expect(state.request).toHaveBeenCalled());
  expect(state.request.mock.calls[0][0]).toBe("/documents");
  expect(state.request.mock.calls[0][1].body.get("file")).toBe(file);
  expect(state.reload).toHaveBeenCalled();
});
it("affiche les notions et citations sans inventer de niveau ou de quiz", () => {
  state.items = [
    {
      id: "one",
      filename: "cours.pdf",
      pageCount: 2,
      status: "COMPLETED",
      attempts: 1,
      analysis: {
        title: "La cellule",
        chapters: [
          {
            title: "Membrane",
            summary: "Synthèse",
            objectives: ["Comprendre"],
            concepts: [
              { name: "Membrane cellulaire", explanation: "Une frontière" },
            ],
            references: [{ page: 2, quote: "Une citation du cours." }],
          },
        ],
      },
    },
  ];
  render(<PdfLibrary />);
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir cours.pdf" }));
  expect(screen.getByText("Membrane cellulaire")).toBeInTheDocument();
  expect(screen.getByText(/Page 2 :/)).toBeInTheDocument();
  expect(screen.getByText(/sans diagnostic préalable/)).toBeInTheDocument();
  expect(screen.queryByText("Notions maîtrisées")).not.toBeInTheDocument();
});
it("présente les échecs IA et permet la reprise explicite", async () => {
  state.items = [
    {
      id: "one",
      filename: "cours.pdf",
      pageCount: 1,
      status: "FAILED",
      attempts: 1,
      analysis: null,
    },
  ];
  state.request.mockRejectedValue(new Error("Service indisponible"));
  render(<PdfLibrary />);
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir cours.pdf" }));
  fireEvent.click(screen.getByRole("button", { name: "Réessayer l’analyse" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Service indisponible"),
  );
  expect(state.request).toHaveBeenCalledWith("/documents/one/analyze", {
    method: "POST",
  });
});

it("permet de reprendre un bail ancien sans recréer le document", async () => {
  state.items = [
    {
      id: "one",
      filename: "cours.pdf",
      pageCount: 1,
      status: "PROCESSING",
      startedAt: "2000-01-01T00:00:00Z",
      canResume: true,
      attempts: 1,
      analysis: null,
    },
  ];
  state.request.mockResolvedValue({ id: "one" });
  render(<PdfLibrary />);
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir cours.pdf" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Reprendre l’analyse interrompue" }),
  );
  await waitFor(() =>
    expect(state.request).toHaveBeenCalledWith("/documents/one/analyze", {
      method: "POST",
    }),
  );
});
