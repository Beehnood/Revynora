import type { GeneratedQuiz, DiagnosticInput } from "./ai.schema";
export const mockTopics = [
  { domain: "Sciences", topic: "Les cellules" },
  { domain: "Mathématiques", topic: "Les fractions" },
  { domain: "Langues", topic: "Le présent simple" },
] as const;
type Entry = [string, string, string, string[], number[]];
const bank: Record<string, { miniCourse: string; entries: Entry[] }> = {
  "Les cellules": {
    miniCourse:
      "La cellule est l’unité de base du vivant. Une membrane plasmique délimite toutes les cellules. Les cellules eucaryotes possèdent un noyau qui contient l’essentiel de leur ADN. Les mitochondries participent à la production d’ATP par respiration cellulaire. Les cellules végétales possèdent aussi une paroi et, dans les tissus photosynthétiques, des chloroplastes. Les bactéries sont des procaryotes : elles ne possèdent pas de noyau délimité par une membrane.",
    entries: [
      [
        "Quelle structure délimite toutes les cellules ?",
        "Membrane plasmique",
        "La membrane plasmique sépare le milieu intracellulaire du milieu extérieur. Toutes les cellules en possèdent une.",
        [
          "La membrane plasmique",
          "Le noyau",
          "La paroi de cellulose",
          "Le chloroplaste",
        ],
        [0],
      ],
      [
        "Où se trouve l’essentiel de l’ADN d’une cellule eucaryote ?",
        "Noyau",
        "Chez les eucaryotes, le noyau abrite l’essentiel de l’ADN. Les mitochondries et chloroplastes possèdent aussi une petite quantité d’ADN.",
        [
          "Dans le noyau",
          "Dans la membrane plasmique",
          "Uniquement dans le cytoplasme",
        ],
        [0],
      ],
      [
        "Quels organites participent directement à la production d’ATP par respiration cellulaire ?",
        "Respiration cellulaire",
        "Les mitochondries assurent une grande partie de la production d’ATP par respiration chez les cellules eucaryotes.",
        ["Les mitochondries", "Les ribosomes", "Les lysosomes"],
        [0],
      ],
      [
        "Quelles structures sont caractéristiques d’une cellule végétale photosynthétique ?",
        "Cellule végétale",
        "Les cellules végétales photosynthétiques possèdent une paroi de cellulose et des chloroplastes. Elles ont aussi une membrane plasmique.",
        [
          "Une paroi de cellulose",
          "Des chloroplastes",
          "Aucune membrane plasmique",
          "Un noyau absent",
        ],
        [0, 1],
      ],
      [
        "Quelle affirmation décrit une bactérie ?",
        "Procaryotes",
        "Une bactérie est une cellule procaryote : son ADN n’est pas contenu dans un noyau délimité par une membrane.",
        [
          "Elle n’a pas de noyau délimité par une membrane",
          "Elle est toujours dépourvue d’ADN",
          "Elle possède toujours des chloroplastes",
        ],
        [0],
      ],
    ],
  },
  "Les fractions": {
    miniCourse:
      "Une fraction a/b représente un quotient, avec b différent de zéro. Pour obtenir une fraction équivalente, on multiplie ou divise le numérateur et le dénominateur par un même nombre non nul. Pour additionner des fractions, on les met au même dénominateur puis on additionne les numérateurs. Pour multiplier, on multiplie les numérateurs entre eux et les dénominateurs entre eux. Pour comparer deux fractions positives, on peut utiliser un dénominateur commun.",
    entries: [
      [
        "Quelle fraction est égale à 1/2 ?",
        "Fractions équivalentes",
        "Multiplier le numérateur et le dénominateur de 1/2 par 2 donne 2/4, sans changer sa valeur.",
        ["2/4", "1/4", "2/3"],
        [0],
      ],
      [
        "Combien vaut 1/4 + 2/4 ?",
        "Addition",
        "Les dénominateurs sont identiques : on additionne les numérateurs, donc (1 + 2)/4 = 3/4.",
        ["3/4", "3/8", "2/4"],
        [0],
      ],
      [
        "Quel est le résultat de 2/3 × 3/4 ?",
        "Multiplication",
        "On multiplie les numérateurs et les dénominateurs : 6/12, qui se simplifie en 1/2.",
        ["1/2", "5/7", "6/7"],
        [0],
      ],
      [
        "Quelles fractions sont égales à 3/4 ?",
        "Simplification",
        "6/8 et 9/12 se simplifient toutes deux en 3/4. En revanche, 3/8 et 4/3 ont des valeurs différentes.",
        ["6/8", "9/12", "3/8", "4/3"],
        [0, 1],
      ],
      [
        "Quelle fraction est la plus grande parmi ces nombres positifs ?",
        "Comparaison",
        "Avec le même dénominateur, on compare les numérateurs : 5/6 est plus grand que 3/6 et 2/6.",
        ["5/6", "1/2", "1/3"],
        [0],
      ],
    ],
  },
  "Le présent simple": {
    miniCourse:
      "En anglais, le présent simple sert notamment à parler des habitudes et des vérités générales. À la troisième personne du singulier, le verbe affirmatif prend généralement -s : she plays. Pour une négation avec I, you, we ou they, on utilise do not, souvent contracté en don’t. Avec he, she ou it, on utilise does not (doesn’t) suivi de la base verbale. Une question utilise do ou does devant le sujet. Le verbe be a ses propres formes : am, is et are.",
    entries: [
      [
        "Quelle phrase est correcte au présent simple ?",
        "Troisième personne",
        "À la troisième personne du singulier, le verbe prend -s : she plays.",
        ["She plays tennis.", "She play tennis.", "She playing tennis."],
        [0],
      ],
      [
        "Comment exprimer correctement une habitude à la forme négative ?",
        "Négation avec do",
        "Avec le sujet I, la négation au présent simple utilise don’t suivi de la base verbale.",
        ["I don’t like tea.", "I doesn’t like tea.", "I not likes tea."],
        [0],
      ],
      [
        "Quelle question est correctement formée au présent simple ?",
        "Questions avec does",
        "Avec he, on place does avant le sujet et on conserve la base verbale work sans -s.",
        ["Does he work here?", "Do he works here?", "Does he works here?"],
        [0],
      ],
      [
        "Quelles phrases décrivent correctement des habitudes au présent simple ?",
        "Habitudes",
        "They walk et he reads sont des formes du présent simple. Is running est au présent progressif, et went est au passé.",
        [
          "They walk to school every day.",
          "He reads every evening.",
          "She is running now.",
          "We went yesterday.",
        ],
        [0, 1],
      ],
      [
        "Quelle forme du verbe be complète « They … students » ?",
        "Verbe be",
        "Le verbe be s’accorde avec they à la forme are au présent.",
        ["are", "is", "am"],
        [0],
      ],
    ],
  },
};
export function mockQuiz(input: DiagnosticInput): GeneratedQuiz | null {
  const match = mockTopics.find(
    (t) => t.domain === input.domain && t.topic === input.topic,
  );
  if (!match || input.level !== "Débutant") return null;
  const data = bank[match.topic];
  return {
    miniCourse: data.miniCourse,
    questions: data.entries.map(
      ([text, concept, explanation, options, correct]) => ({
        text,
        concept,
        explanation,
        type: correct.length > 1 ? "MULTIPLE" : "SINGLE",
        options: options.map((text, index) => ({
          text,
          correct: correct.includes(index),
        })),
      }),
    ),
  };
}
