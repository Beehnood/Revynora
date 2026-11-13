import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PdfDiagnostic } from "../components/learning/pdf-diagnostic";
import type { PdfCourse } from "@revynora/types";
const { api, push } = vi.hoisted(() => ({ api: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/api", () => ({ api, message: (e: Error) => e.message }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/use-resource", () => ({
  useResource: () => ({
    data: { items: [] },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
const document: PdfCourse = {
  id: "doc",
  filename: "cours.pdf",
  pageCount: 2,
  status: "COMPLETED",
  errorCode: null,
  attempts: 1,
  canResume: false,
  createdAt: "2026-11-12T00:00:00Z",
  startedAt: null,
  analysis: {
    title: "La cellule",
    chapters: [
      {
        title: "Membrane",
        summary: "Une synthèse sourcée du cours.",
        objectives: ["Comprendre"],
        concepts: [{ name: "Membrane", explanation: "Contrôle des échanges" }],
        references: [{ page: 1, quote: "La membrane contrôle les échanges." }],
      },
    ],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  api.mockImplementation((url: string) =>
    Promise.resolve(
      url.includes("/documents/") ? { id: "quiz" } : { id: "attempt" },
    ),
  );
});
describe("PDF diagnostic journeys", () => {
  it("lets discovery readers see the source before explicitly starting a quiz", async () => {
    render(<PdfDiagnostic document={document} available />);
    expect(
      screen.queryByText("Une synthèse sourcée du cours."),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Je découvre ce cours" }),
    );
    expect(
      screen.getByText("Une synthèse sourcée du cours."),
    ).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Commencer le quiz diagnostic" }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/app/tentatives/attempt"),
    );
    expect(api).toHaveBeenCalledWith(
      "/quizzes/quiz/attempts",
      expect.objectContaining({ body: JSON.stringify({ mode: "DISCOVER" }) }),
    );
  });
  it("starts knowledge testing directly without requiring a subject or revealing the summary", async () => {
    render(<PdfDiagnostic document={document} available />);
    fireEvent.click(
      screen.getByRole("button", { name: "Je teste mes connaissances" }),
    );
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(
      screen.queryByText("Une synthèse sourcée du cours."),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(api).toHaveBeenCalledWith(
      "/quizzes/quiz/attempts",
      expect.objectContaining({ body: JSON.stringify({ mode: "TEST" }) }),
    );
  });
  it("keeps discovery readable but refuses generation when no real provider is configured", () => {
    render(<PdfDiagnostic document={document} available={false} />);
    expect(
      screen.getByRole("button", { name: "Je teste mes connaissances" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Je découvre ce cours" }),
    );
    expect(
      screen.getByText("Une synthèse sourcée du cours."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Commencer le quiz diagnostic" }),
    ).toBeDisabled();
    expect(api).not.toHaveBeenCalled();
  });
  it("allows an existing verified quiz without a provider and surfaces errors honestly", async () => {
    api.mockRejectedValue(new Error("Limite de tentatives atteinte."));
    render(
      <PdfDiagnostic
        document={{ ...document, quiz: { id: "saved" } }}
        available={false}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Je teste mes connaissances" }),
    );
    await screen.findByRole("alert");
    expect(api).not.toHaveBeenCalledWith(
      "/documents/doc/quiz",
      expect.anything(),
    );
    expect(push).not.toHaveBeenCalled();
  });
});
