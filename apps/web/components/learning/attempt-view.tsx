"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Attempt } from "@revynora/types";
import { api, message } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { ResourceState } from "./resource-state";
import { Alert, Badge, Card, PageHeader } from "../ui";
import { Button } from "../ui/button";
import { ArrowRight, BookOpen, CheckCircle2, ClipboardCheck } from "../icons";
function equals(a: string[], b: string[]) {
  return a.length === b.length && a.every((v) => b.includes(v));
}
export function AttemptView({ id }: { id: string }) {
  const state = useResource<Attempt>(`/attempts/${id}`);
  return (
    <>
      <ResourceState {...state} retry={state.reload} />
      {state.data ? (
        <AttemptContent key={state.data.id} initial={state.data} />
      ) : (
        <PageHeader
          title="Ton diagnostic"
          description="Retrouve tes questions et tes réponses sauvegardées."
        />
      )}
    </>
  );
}
function AttemptContent({ initial }: { initial: Attempt }) {
  const [attempt, setAttempt] = useState(initial);
  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      initial.answers.map((a) => [a.questionId, a.selectedOptionIds]),
    ),
  );
  const [saved, setSaved] = useState(selected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const questions = attempt.quiz.questions;
  const dirty = questions.some(
    (q) => !equals(selected[q.id] ?? [], saved[q.id] ?? []),
  );
  const savedCount = questions.filter(
    (q) => (saved[q.id]?.length ?? 0) > 0,
  ).length;
  const chosen = questions.filter(
    (q) => (selected[q.id]?.length ?? 0) > 0,
  ).length;
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    if (dirty && !attempt.submittedAt)
      window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, attempt.submittedAt]);
  if (attempt.result) {
    const result = attempt.result;
    return (
      <>
        <div className="heading-action">
          <PageHeader
            title="Chaque réponse t’apprend quelque chose."
            description={`${attempt.quiz.topic} · ${attempt.quiz.level}`}
          />
          <Button asChild>
            <Link href="/app/diagnostic">
              Nouvel exercice <ArrowRight size={17} />
            </Link>
          </Button>
        </div>
        {attempt.quiz.provider === "mock" && (
          <Alert>
            Exercice de démonstration prédéfini · Correction pédagogique de
            référence.
          </Alert>
        )}
        <div className="result-overview">
          <Card className="score-card">
            <span className="score-ring">
              {attempt.score}
              <small>/ 100</small>
            </span>
            <div>
              <Badge>Diagnostic terminé</Badge>
              <h2>
                {result.score >= 80
                  ? "De belles bases pour la suite !"
                  : result.score >= 40
                    ? "Tu es sur le bon chemin."
                    : "Un point de départ pour progresser."}
              </h2>
              <p>
                {result.corrected.filter((q) => q.correct).length} bonnes
                réponses sur 5 · Corrigé le{" "}
                {new Date(attempt.submittedAt!).toLocaleDateString("fr-FR", {
                  timeZone: "Europe/Paris",
                })}
              </p>
            </div>
          </Card>
          <Card>
            <h2>Ton bilan</h2>
            <h3 className="concept-heading">Notions maîtrisées</h3>
            <div className="concept-list">
              {result.mastered.length ? (
                result.mastered.map((c) => (
                  <Badge key={c} className="positive-badge">
                    {c}
                  </Badge>
                ))
              ) : (
                <p>
                  Chaque explication ci-dessous t’aide à construire tes bases.
                </p>
              )}
            </div>
            <h3 className="concept-heading">À approfondir</h3>
            <div className="concept-list">
              {result.weak.length ? (
                result.weak.map((c) => <Badge key={c}>{c}</Badge>)
              ) : (
                <p>Aucune notion faible sur ce test.</p>
              )}
            </div>
          </Card>
        </div>
        <section aria-labelledby="correction-title">
          <h2 id="correction-title" className="subsection-heading">
            Comprendre la correction
          </h2>
          <div className="correction-list">
            {questions.map((q, index) => {
              const solution = result.questions.find((s) => s.id === q.id)!;
              const correct = result.corrected.find(
                (s) => s.questionId === q.id,
              )!.correct;
              return (
                <Card key={q.id} className="correction-card">
                  <div className="question-meta">
                    <span>
                      QUESTION {index + 1} · {solution.concept}
                    </span>
                    <Badge
                      className={correct ? "positive-badge" : "review-badge"}
                    >
                      {correct ? "Bonne réponse" : "À revoir"}
                    </Badge>
                  </div>
                  <h3>{q.text}</h3>
                  <ul className="solution-options">
                    {q.options.map((o) => (
                      <li
                        key={o.id}
                        className={
                          solution.correctOptionIds.includes(o.id)
                            ? "solution-correct"
                            : ""
                        }
                      >
                        <span>{o.text}</span>
                        <div>
                          {solution.correctOptionIds.includes(o.id) && (
                            <span>✓ Réponse attendue</span>
                          )}
                          {attempt.answers
                            .find((a) => a.questionId === q.id)
                            ?.selectedOptionIds.includes(o.id) && (
                            <Badge>Ton choix</Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="explanation">
                    <CheckCircle2 size={18} />
                    <p>{solution.explanation}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
        <Card className="mini-course">
          <div className="card-heading">
            <h2>
              <BookOpen size={23} /> Le mini-cours pour consolider
            </h2>
            <Badge>
              {attempt.quiz.provider === "mock"
                ? "Contenu de démonstration"
                : "Contenu généré par IA"}
            </Badge>
          </div>
          <p>{result.miniCourse}</p>
          {attempt.quiz.provider !== "mock" && (
            <small>
              Une IA peut produire des erreurs : compare ce contenu à tes
              supports de référence.
            </small>
          )}
          <Link href="/app/cours" className="text-link">
            Retrouver dans mes cours →
          </Link>
        </Card>
        <div className="result-actions">
          <Button asChild>
            <Link href="/app/diagnostic">
              Continuer avec un nouveau diagnostic <ArrowRight size={17} />
            </Link>
          </Button>
          <Link href="/app/historique" className="text-link">
            Tous mes résultats
          </Link>
        </div>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title={attempt.quiz.topic}
        description={`${attempt.quiz.domain} · ${attempt.quiz.level} · 5 questions pour faire le point`}
      />
      {attempt.quiz.provider === "mock" && (
        <Alert>
          Mode démonstration : cet exercice est prédéfini, sans génération IA.
        </Alert>
      )}
      <p className="quiz-instructions">
        Pour les questions à choix multiples, sélectionne toutes les bonnes
        réponses. Chaque question vaut 20 points, sans point partiel. Enregistre
        tes choix avant de soumettre.
      </p>
      <div className="quiz-toolbar">
        <div>
          <strong>{chosen} / 5 réponses choisies</strong>
          <span>
            {savedCount} / 5 sauvegardées
            {dirty ? " · Modifications non enregistrées" : ""}
          </span>
        </div>
        <Badge>Diagnostic en cours</Badge>
      </div>
      <progress
        className="quiz-progress"
        aria-label="Questions renseignées"
        max={5}
        value={chosen}
      />
      <form onSubmit={(e) => e.preventDefault()} className="quiz-form">
        <div className="question-list">
          {questions.map((q, index) => (
            <Card key={q.id}>
              <fieldset disabled={busy}>
                <legend>
                  <span className="question-meta">
                    QUESTION {index + 1} SUR 5 ·{" "}
                    {q.type === "MULTIPLE"
                      ? "PLUSIEURS RÉPONSES"
                      : "UNE SEULE RÉPONSE"}
                  </span>
                  <span className="question-title">{q.text}</span>
                </legend>
                <div className="answer-options">
                  {q.options.map((o) => (
                    <label
                      className={
                        (selected[q.id] ?? []).includes(o.id)
                          ? "answer-option selected"
                          : "answer-option"
                      }
                      key={o.id}
                    >
                      <input
                        type={q.type === "MULTIPLE" ? "checkbox" : "radio"}
                        name={q.id}
                        value={o.id}
                        checked={(selected[q.id] ?? []).includes(o.id)}
                        onChange={() => {
                          setNotice("");
                          setConfirmed(false);
                          setSelected((current) => ({
                            ...current,
                            [q.id]:
                              q.type === "SINGLE"
                                ? [o.id]
                                : (current[q.id] ?? []).includes(o.id)
                                  ? current[q.id].filter((v) => v !== o.id)
                                  : [...(current[q.id] ?? []), o.id],
                          }));
                        }}
                      />
                      <span>{o.text}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </Card>
          ))}
        </div>
        <Card className="submission-card">
          <h2>
            <ClipboardCheck size={22} /> Fais le point avant de corriger
          </h2>
          <p>
            Enregistre tes réponses pour pouvoir reprendre plus tard. Une fois
            le test soumis, tes réponses seront définitives.
          </p>
          {error && <Alert role="alert">{error}</Alert>}
          {notice && <Alert>{notice}</Alert>}
          <Button
            type="button"
            variant="outline"
            disabled={busy || !dirty}
            onClick={async () => {
              setBusy(true);
              setError("");
              setNotice("");
              try {
                for (const q of questions) {
                  const value = selected[q.id] ?? [];
                  if (equals(value, saved[q.id] ?? [])) continue;
                  await api(`/attempts/${attempt.id}/answers/${q.id}`, {
                    method: "PUT",
                    body: JSON.stringify({ selectedOptionIds: value }),
                  });
                  setSaved((current) => ({ ...current, [q.id]: value }));
                }
                setNotice(
                  "Tes réponses sont sauvegardées. Tu peux reprendre ce test depuis ton historique.",
                );
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Enregistrement…" : "Enregistrer mes réponses"}
          </Button>
          <label className="confirm-label">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy || dirty || savedCount !== 5}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              J’ai vérifié mes cinq réponses et je souhaite recevoir la
              correction définitive.
            </span>
          </label>
          <Button
            type="button"
            disabled={busy || dirty || savedCount !== 5 || !confirmed}
            aria-busy={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const completed = await api<Attempt>(
                  `/attempts/${attempt.id}/submit`,
                  { method: "POST" },
                );
                setAttempt(completed);
                window.scrollTo({ top: 0, behavior: "instant" });
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Vérification…" : "Soumettre et voir ma correction"}
            <ArrowRight size={17} />
          </Button>
          <Link
            href="/app/historique"
            className="text-link"
            onClick={(e) => {
              if (
                dirty &&
                !window.confirm(
                  "Certaines modifications ne sont pas sauvegardées. Quitter le test ?",
                )
              )
                e.preventDefault();
            }}
          >
            Reprendre plus tard
          </Link>
        </Card>
      </form>
    </>
  );
}
