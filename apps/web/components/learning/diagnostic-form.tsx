"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { diagnosticSchema } from "@revynora/validation";
import type { LearningConfig, PublicQuiz } from "@revynora/types";
import { useResource } from "@/lib/use-resource";
import { api, message } from "@/lib/api";
import { ResourceState } from "./resource-state";
import {
  Alert,
  Badge,
  Card,
  FormField,
  Input,
  PageHeader,
  Select,
} from "../ui";
import { Button } from "../ui/button";
import { Sparkles, ArrowRight, ClipboardCheck, BookOpen } from "../icons";
export function DiagnosticForm() {
  const router = useRouter();
  const state = useResource<LearningConfig>("/learning/config");
  const [domain, setDomain] = useState("Sciences");
  const [topic, setTopic] = useState("Les cellules");
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
              <FormField id="domain" label="Domaine" error={errors.domain}>
                <Select
                  id="domain"
                  name="domain"
                  value={domain}
                  disabled={busy || !!generated}
                  onChange={(e) => {
                    setDomain(e.target.value);
                    setTopic(
                      state.data?.mockTopics.find(
                        (t) => t.domain === e.target.value,
                      )?.topic ?? "",
                    );
                  }}
                >
                  {["Sciences", "Mathématiques", "Langues"].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </FormField>
              <FormField
                id="topic"
                label="Sujet à explorer"
                error={errors.topic}
              >
                {state.data.provider === "mock" ? (
                  <Select
                    id="topic"
                    name="topic"
                    value={topic}
                    disabled={busy || !!generated}
                    onChange={(e) => setTopic(e.target.value)}
                  >
                    {state.data.mockTopics
                      .filter((t) => t.domain === domain)
                      .map((t) => (
                        <option key={t.topic}>{t.topic}</option>
                      ))}
                  </Select>
                ) : (
                  <Input
                    id="topic"
                    name="topic"
                    value={topic}
                    disabled={busy || !!generated}
                    onChange={(e) => setTopic(e.target.value)}
                    maxLength={160}
                    required
                    aria-invalid={!!errors.topic}
                    aria-describedby={errors.topic ? "topic-error" : undefined}
                  />
                )}
              </FormField>
              <FormField id="level" label="Niveau" error={errors.level}>
                <Select id="level" name="level" disabled={busy || !!generated}>
                  {(state.data.provider === "mock"
                    ? ["Débutant"]
                    : ["Débutant", "Intermédiaire", "Avancé"]
                  ).map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </FormField>
              <Alert>
                <span>
                  {state.data.provider === "mock" ? (
                    <>
                      <strong>Mode démonstration</strong> · Exercices
                      prédéfinis, sans appel à une IA. Trois sujets de niveau
                      débutant sont disponibles.
                    </>
                  ) : (
                    <>
                      <strong>Génération avec OpenAI</strong> · Le domaine, le
                      sujet et le niveau sont transmis au fournisseur. L’IA peut
                      se tromper : confronte la correction à ton cours.
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
                  <p>Sans pression, à ton rythme.</p>
                </div>
              </li>
              <li>
                <Sparkles size={19} />
                <div>
                  <strong>Comprends tes réponses</strong>
                  <p>Une correction pour chaque notion.</p>
                </div>
              </li>
              <li>
                <BookOpen size={19} />
                <div>
                  <strong>Continue avec un mini-cours</strong>
                  <p>Pour consolider ce que tu viens de voir.</p>
                </div>
              </li>
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
