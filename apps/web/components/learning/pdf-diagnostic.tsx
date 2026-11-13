"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PdfCourse } from "@revynora/types";
import { api, message } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { Alert } from "../ui";
import { Button } from "../ui/button";
import { ResourceState } from "./resource-state";
type Mode = "DISCOVER" | "TEST";
export function PdfDiagnostic({
  document,
  available,
}: {
  document: PdfCourse;
  available: boolean;
}) {
  const [mode, setMode] = useState<Mode | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false);
  const router = useRouter();
  const history = useResource<{
    items: {
      id: string;
      score: number | null;
      submittedAt: string | null;
      startedAt: string;
      mode: string | null;
    }[];
  }>(`/documents/${document.id}/quiz-attempts`);
  const analysis = document.analysis;
  if (!analysis) return null;
  async function start(selected: Mode) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const quiz =
        document.quiz ??
        (await api<{ id: string }>(`/documents/${document.id}/quiz`, {
          method: "POST",
        }));
      const attempt = await api<{ id: string }>(
        `/quizzes/${quiz.id}/attempts`,
        { method: "POST", body: JSON.stringify({ mode: selected }) },
      );
      router.push(`/app/tentatives/${attempt.id}`);
    } catch (e) {
      setError(message(e));
    } finally {
      pending.current = false;
      setBusy(false);
      history.reload();
    }
  }
  const canStart = available || !!document.quiz;
  return (
    <>
      <h3>{analysis.title}</h3>
      <p>
        Choisis ton parcours, sans sélectionner de matière. Le diagnostic donne
        une estimation pédagogique, pas une note scolaire officielle.
      </p>
      <div className="heading-action">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setMode("DISCOVER")}
        >
          Je découvre ce cours
        </Button>
        <Button
          disabled={busy || !canStart}
          onClick={() => {
            setMode("TEST");
            void start("TEST");
          }}
        >
          Je teste mes connaissances
        </Button>
      </div>
      {!canStart && (
        <Alert role="status">
          Quiz indisponible : aucun fournisseur IA réel n’est configuré. Aucun
          exercice fictif ne sera généré.
        </Alert>
      )}
      {busy && <p role="status">Préparation du diagnostic…</p>}
      {error && <Alert role="alert">{error}</Alert>}
      {mode === "DISCOVER" && (
        <>
          {analysis.chapters.map((chapter, i) => (
            <section key={i}>
              <h3>{chapter.title}</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{chapter.summary}</p>
              <h4>Objectifs pédagogiques</h4>
              <ul>
                {chapter.objectives.map((o, j) => (
                  <li key={j}>{o}</li>
                ))}
              </ul>
              <h4>Notions essentielles</h4>
              <dl>
                {chapter.concepts.map((c, j) => (
                  <div key={j}>
                    <dt>{c.name}</dt>
                    <dd>{c.explanation}</dd>
                  </div>
                ))}
              </dl>
              <details>
                <summary>Références au document</summary>
                {chapter.references.map((r, j) => (
                  <blockquote key={j}>
                    Page {r.page} : « {r.quote} »
                  </blockquote>
                ))}
              </details>
            </section>
          ))}
          <Button
            disabled={busy || !canStart}
            onClick={() => void start("DISCOVER")}
          >
            Commencer le quiz diagnostic
          </Button>
        </>
      )}
      <p>
        Les générations sont limitées ; un quiz enregistré est réutilisé. Une
        analyse IA peut comporter des erreurs : vérifie les citations.
      </p>
      <h3>Mes tentatives sur ce document</h3>
      <ResourceState {...history} retry={history.reload} />
      {history.data?.items.length === 0 && (
        <p>Aucune tentative pour le moment.</p>
      )}
      <ul>
        {history.data?.items.map((a) => (
          <li key={a.id}>
            <Link href={`/app/tentatives/${a.id}`}>
              {a.submittedAt
                ? `Diagnostic : ${a.score}/100`
                : "Reprendre le diagnostic"}{" "}
              · {new Date(a.startedAt).toLocaleDateString("fr-FR")}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
