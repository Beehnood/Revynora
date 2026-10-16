import Link from "next/link";
import type { AttemptSummary } from "@revynora/types";
import { Badge, EmptyState } from "../ui";
import { ChevronRight } from "../icons";
export function HistoryList({ items }: { items: AttemptSummary[] }) {
  return items.length ? (
    <ul className="history-list">
      {items.map((a) => (
        <li key={a.id}>
          <Link href={`/app/tentatives/${a.id}`}>
            <span className="icon-tile purple">
              <span aria-hidden="true">✧</span>
            </span>
            <div>
              <strong>{a.quiz.topic}</strong>
              <small>
                {a.quiz.domain} · {a.quiz.level} ·{" "}
                {new Date(a.startedAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "Europe/Paris",
                })}
              </small>
              {a.quiz.provider === "mock" && (
                <span className="mock-label">Exercice de démonstration</span>
              )}
            </div>
            <Badge>{a.submittedAt ? `${a.score} / 100` : "À terminer"}</Badge>
            <ChevronRight size={17} />
          </Link>
        </li>
      ))}
    </ul>
  ) : (
    <EmptyState title="Ton premier déclic t’attend">
      Lance un diagnostic pour découvrir tes points forts et retrouver tes
      résultats ici.
    </EmptyState>
  );
}
