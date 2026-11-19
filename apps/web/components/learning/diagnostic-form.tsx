"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { diagnosticSchema } from "@revynora/validation";
import type { LearningConfig, PublicQuiz } from "@revynora/types";
import { useResource } from "@/lib/use-resource";
import { api, message } from "@/lib/api";
import { ResourceState } from "./resource-state";
import { Alert, Badge, Card, FormField, Textarea, PageHeader } from "../ui";
import { Button } from "../ui/button";
import { Sparkles, ArrowRight, ClipboardCheck, BookOpen } from "../icons";
export function DiagnosticForm() {
  const router = useRouter();
  const state = useResource<LearningConfig>("/learning/config");
  const [topic, setTopic] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<PublicQuiz | null>(null);
  async function start(quiz: PublicQuiz) {
    const attempt = await api<{ id: string }>(`/quizzes/${quiz.id}/attempts`, {
      method: "POST",
    });
    router.push(`/app/tentatives/${attempt.id}`);
  }
  return (
    <>
      <PageHeader
        title="Un sujet. Cinq questions. Un déclic."
        description="Commence par un diagnostic pour découvrir ce que tu maîtrises déjà."
      />
      <div className="diagnostic-grid">
        <Card>
          <div className="card-heading">
            <h2>Prépare ton diagnostic</h2>
            <span className="icon-tile purple">
              <Sparkles />
            </span>
          </div>
          <ResourceState {...state} retry={state.reload} />
          {state.data && (
            <form
              noValidate
              className="form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                setError("");
                if (generated) {
                  setBusy(true);
                  try {
                    await start(generated);
                  } catch (error) {
                    setError(message(error));
                    setBusy(false);
                  }
                  return;
                }
                const result = diagnosticSchema.safeParse(
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
                if (!result.success) {
                  setErrors(
                    Object.fromEntries(
                      result.error.issues.map((i) => [i.path[0], i.message]),
                    ),
                  );
                  return;
                }
                setErrors({});
                setBusy(true);
                try {
                  const quiz = await api<PublicQuiz>("/quizzes/diagnostic", {
                    method: "POST",
                    body: JSON.stringify(result.data),
                  });
                  setGenerated(quiz);
                  await start(quiz);
                } catch (error) {
                  setError(message(error));
                  setBusy(false);
                  state.reload();
                }
              }}
            >
              <FormField
                id="topic"
                label="Que souhaites-tu apprendre ?"
                error={errors.topic}
              >
                <Textarea
                  id="topic"
                  name="topic"
                  value={topic}
                  rows={3}
                  placeholder="Ex. Comprendre les fractions et savoir les utiliser dans des problèmes."
                  disabled={busy || !!generated}
                  onChange={(e) => setTopic(e.target.value)}
                  maxLength={160}
                  required
                  aria-invalid={!!errors.topic}
                  aria-describedby={errors.topic ? "topic-error" : "topic-help"}
                />
                <small id="topic-help">
                  Décris ton objectif librement, sans choisir de niveau. Jusqu’à
                  160 caractères.
                </small>
              </FormField>
              {state.data.provider === "mock" && (
                <fieldset>
                  <legend>Exemples de démonstration</legend>
                  {state.data.mockTopics.map((example) => (
                    <Button
                      key={example.topic}
                      type="button"
                      variant="outline"
                      disabled={busy || !!generated}
                      onClick={() => setTopic(example.topic)}
                    >
                      Exemple : {example.topic}
                    </Button>
                  ))}
                </fieldset>
              )}
              <Alert>
                <span>
                  {state.data.provider === "mock" ? (
                    <>
                      <strong>Mode démonstration</strong> · Exercices
                      prédéfinis, sans appel à une IA. Les exemples disponibles
                      sont limités ; aucun niveau personnel n’est estimé en
                      démonstration.
                    </>
                  ) : (
                    <>
                      <strong>Génération IA</strong> · Ta description sert à
                      préparer des questions de difficultés variées. Ton niveau
                      n’est pas présumé : le serveur estime ta réussite après
                      les réponses. L’IA peut se tromper ; vérifie les
                      corrections.
                    </>
                  )}
                </span>
              </Alert>
              <small className="privacy-note">
                N’indique aucune donnée personnelle. Une génération, même
                échouée, consomme une unité du quota pour limiter les abus.
                Aucun e-mail ni mot de passe n’est transmis au fournisseur.
              </small>
              <div className="quota-line">
                <span>
                  {state.data.remaining} / {state.data.dailyLimit} générations
                  restantes
                </span>
                <Badge>Renouvellement {state.data.reset}</Badge>
              </div>
              {error && <Alert role="alert">{error}</Alert>}
              {busy && (
                <div role="status" className="generation-status">
                  <span className="skeleton" />
                  <strong>
                    {generated
                      ? "Ouverture de ta tentative…"
                      : "Préparation des cinq questions…"}
                  </strong>
                  <p>Tu pourras reprendre ce test depuis ton historique.</p>
                </div>
              )}
              <Button
                disabled={busy || (!generated && state.data.remaining === 0)}
                aria-busy={busy}
              >
                {busy
                  ? "Préparation…"
                  : generated
                    ? "Ouvrir le test préparé"
                    : "Lancer mon diagnostic"}
                <ArrowRight size={17} />
              </Button>
            </form>
          )}
        </Card>
        <div className="diagnostic-aside">
          <Card className="daily-card">
            <span className="eyebrow">COMMENT ÇA MARCHE ?</span>
            <h2>Apprendre commence par une question.</h2>
            <ol className="learning-steps">
              <li>
                <ClipboardCheck size={19} />
                <div>
                  <strong>Réponds à cinq questions</strong>
                  <p>
                    Des repères, des applications et du raisonnement, sans
                    niveau à sélectionner.
                  </p>
                </div>
              </li>
              <li>
                <Sparkles size={19} />
                <div>
                  <strong>Comprends ton bilan</strong>
                  <p>
                    Score calculé par le serveur, corrections et estimation
                    pédagogique provisoire.
                  </p>
                </div>
              </li>
              <li>
                <BookOpen size={19} />
                <div>
                  <strong>Construis ton parcours de révision</strong>
                  <p>
                    Des notions prioritaires et des actions adaptées aux
                    réponses, à réviser lors d’un nouveau test.
                  </p>
                </div>
              </li>
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
