import type { PdfDiagnostic } from "./pdf-quiz.schema";
export const quizPages = [
  {
    page: 1,
    text: "La membrane separe la cellule de son environnement et controle les echanges.",
  },
  {
    page: 2,
    text: "La photosynthese transforme l energie lumineuse en energie chimique dans les chloroplastes.",
  },
];
export const quizAnalysis = {
  title: "Cellule et energie",
  chapters: [
    {
      title: "La cellule",
      summary: quizPages[0].text,
      objectives: ["Comprendre la membrane"],
      concepts: [{ name: "Membrane", explanation: "Controle les echanges." }],
      references: [{ page: 1, quote: quizPages[0].text }],
    },
    {
      title: "Energie",
      summary: quizPages[1].text,
      objectives: ["Comprendre la photosynthese"],
      concepts: [
        {
          name: "Photosynthese",
          explanation: "Convertit l energie lumineuse.",
        },
      ],
      references: [{ page: 2, quote: quizPages[1].text }],
    },
  ],
};
export function diagnosticFixture(): PdfDiagnostic {
  return {
    questions: [
      "Quel element controle les echanges de la cellule ?",
      "Quelle energie est utilisee lors de la photosynthese ?",
      "Quelle structure separe la cellule de son environnement ?",
      "En quelle energie la lumiere est-elle transformee ?",
      "Quel role joue la membrane dans les echanges ?",
    ].map((text, i) => ({
      text,
      concept: i % 2 ? "Photosynthese" : "Membrane",
      explanation:
        "La reponse correspond a la definition donnee dans le passage source.",
      type: "SINGLE",
      chapterIndex: i % 2,
      reference: { page: (i % 2) + 1, quote: quizPages[i % 2].text },
      options: [
        "Proposition exacte",
        "Distracteur plausible A",
        "Distracteur plausible B",
        "Distracteur plausible C",
      ].map((text, j) => ({ text, correct: j === i % 4 })),
    })),
  };
}
