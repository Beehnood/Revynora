"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api, message } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import {
  Card,
  PageHeader,
  Alert,
  Badge,
  FormField,
  Textarea,
  LoadingState,
} from "../ui";
import { Button } from "../ui/button";
type Flashcard = {
  id: string;
  front: string;
  back: string;
  box: number;
  version: number;
  dueAt: string;
};
export function LeitnerView() {
  const [page, setPage] = useState(1);
  const cards = useResource<{ items: Flashcard[]; total: number }>(
      page === 1 ? "/leitner/cards" : "/leitner/cards?page=" + page,
    ),
    due = useResource<{ items: Flashcard[]; total: number }>(
      "/leitner/cards/due",
    );
  const stats = useResource<{
    boxes: { box: number; _count: number }[];
    totalReviews: number;
    recent: { id: string; remembered: boolean; createdAt: string }[];
  }>("/leitner/stats");
  const [editing, setEditing] = useState<Flashcard | null>(null);
  const [front, setFront] = useState(""),
    [back, setBack] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [session, setSession] = useState<Flashcard[] | null>(null),
    [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false);
  const card = session?.[index];
  async function review(remembered: boolean) {
    if (!card || busy) return;
    setBusy(true);
    try {
      await api("/leitner/cards/" + card.id + "/review", {
        method: "POST",
        body: JSON.stringify({
          version: card.version,
          requestId: crypto.randomUUID(),
          remembered,
        }),
      });
      setIndex((i) => i + 1);
      setFlipped(false);
      due.reload();
      cards.reload();
      stats.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        !card ||
        ["INPUT", "TEXTAREA", "BUTTON"].includes(
          (e.target as HTMLElement).tagName,
        )
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped(true);
      }
      if (flipped && e.key === "1") void review(false);
      if (flipped && e.key === "2") void review(true);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  return (
    <>
      <PageHeader
        title="Mes révisions"
        description="Un peu aujourd’hui, mieux retenu demain. Les cinq boîtes Leitner espacent tes rappels."
      />
      {(cards.error || due.error) && (
        <Alert role="alert">
          {cards.error || due.error}{" "}
          <Link href="/app/abonnement">Voir les offres Plus et Pro</Link>
        </Alert>
      )}
      {error && <Alert role="alert">{error}</Alert>}
      {cards.loading && <LoadingState />}
      {cards.data && (
        <>
          <Card>
            <div className="card-heading">
              <h2>Ta séance du jour</h2>
              <Badge>{due.data?.total ?? 0} à revoir</Badge>
            </div>
            {!session ? (
              <>
                <p>
                  Retourne chaque carte, puis évalue ton souvenir. Espace :
                  réponse · 1 : à revoir · 2 : retenu.
                </p>
                <Button
                  disabled={!due.data?.items.length}
                  onClick={() => {
                    setSession(due.data!.items);
                    setIndex(0);
                    setFlipped(false);
                  }}
                >
                  Commencer la révision
                </Button>
              </>
            ) : card ? (
              <div className="flashcard" aria-live="polite">
                <Badge>
                  Carte {index + 1}/{session.length} · Boîte {card.box}
                </Badge>
                <h2>{card.front}</h2>
                {flipped ? (
                  <>
                    <p>{card.back}</p>
                    <div className="saas-actions">
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => review(false)}
                      >
                        À revoir (1)
                      </Button>
                      <Button disabled={busy} onClick={() => review(true)}>
                        Retenu (2)
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button onClick={() => setFlipped(true)}>
                    Afficher la réponse
                  </Button>
                )}
              </div>
            ) : (
              <div role="status">
                <h3>Séance terminée !</h3>
                <p>
                  {index} cartes révisées. La prochaine échéance est
                  enregistrée.
                </p>
                <Button onClick={() => setSession(null)}>
                  Revenir à mes cartes
                </Button>
              </div>
            )}
          </Card>
          <Card>
            <h2>{editing ? "Modifier la carte" : "Créer une carte"}</h2>
            <form
              className="saas-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api(
                    editing ? "/leitner/cards/" + editing.id : "/leitner/cards",
                    {
                      method: editing ? "PATCH" : "POST",
                      body: JSON.stringify({
                        front,
                        back,
                        ...(editing ? { version: editing.version } : {}),
                      }),
                    },
                  );
                  setEditing(null);
                  setFront("");
                  setBack("");
                  cards.reload();
                  due.reload();
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <FormField id="front" label="Question">
                <Textarea
                  id="front"
                  required
                  maxLength={1000}
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                />
              </FormField>
              <FormField id="back" label="Réponse">
                <Textarea
                  id="back"
                  required
                  maxLength={4000}
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                />
              </FormField>
              <div className="saas-actions">
                <Button disabled={busy}>
                  {editing ? "Enregistrer la carte" : "Créer la carte"}
                </Button>
                {editing && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditing(null);
                      setFront("");
                      setBack("");
                    }}
                  >
                    Annuler la modification
                  </Button>
                )}
              </div>
            </form>
          </Card>
          {stats.data && (
            <Card>
              <h2>Ma progression</h2>
              <p>{stats.data.totalReviews} révisions enregistrées</p>
              <div className="leitner-boxes">
                {[1, 2, 3, 4, 5].map((box) => (
                  <div key={box}>
                    <Badge>Boîte {box}</Badge>
                    <strong>
                      {stats.data!.boxes.find((b) => b.box === box)?._count ??
                        0}
                    </strong>
                  </div>
                ))}
              </div>
              <h3>Dernières révisions</h3>
              {stats.data.recent.map((r) => (
                <p key={r.id}>
                  {r.remembered ? "Retenu" : "À revoir"} ·{" "}
                  {new Date(r.createdAt).toLocaleString("fr-FR")}
                </p>
              ))}
            </Card>
          )}
          <Card>
            <h2>Ma collection · {cards.data.total} cartes</h2>
            {!cards.data.total && (
              <p>Ta première carte t’attend. Ajoute une notion à retenir.</p>
            )}
            {cards.data.items.map((c) => (
              <div className="saas-row" key={c.id}>
                <div>
                  <strong>{c.front}</strong>
                  <p>
                    Boîte {c.box} ·{" "}
                    {new Date(c.dueAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={busy || !!session}
                  onClick={() => {
                    setEditing(c);
                    setFront(c.front);
                    setBack(c.back);
                    document.getElementById("front")?.focus();
                  }}
                >
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api("/leitner/cards/" + c.id, { method: "DELETE" });
                      cards.reload();
                      due.reload();
                    } catch (e) {
                      setError(message(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Archiver
                </Button>
              </div>
            ))}
            {cards.data.total > 100 && (
              <div className="saas-actions">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Précédent
                </Button>
                <span>Page {page}</span>
                <Button
                  variant="outline"
                  disabled={page * 100 >= cards.data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </Button>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
