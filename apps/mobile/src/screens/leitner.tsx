import { randomUUID } from "expo-crypto";
import { useRef, useState } from "react";
import type { LeitnerCardView, PageResult } from "@revynora/types";
import { api } from "../api";
import {
  Screen,
  Title,
  Card,
  Copy,
  Button,
  Field,
  Notice,
  useAction,
  useRemote,
  Resource,
  Alert,
  Text,
  s,
} from "../components/ui";
import { Pagination } from "./learning";
type Stats = {
  boxes: { box: number; _count: number }[];
  intervals: number[];
  totalReviews: number;
  recent: { id: string; remembered: boolean; createdAt: string }[];
};
export function LeitnerScreen() {
  const [page, setPage] = useState(1),
    cards = useRemote<PageResult<LeitnerCardView>>(
      "/leitner/cards?page=" + page,
    ),
    due = useRemote<PageResult<LeitnerCardView>>("/leitner/cards/due"),
    stats = useRemote<Stats>("/leitner/stats"),
    [front, setFront] = useState(""),
    [back, setBack] = useState(""),
    [editing, setEditing] = useState<LeitnerCardView | null>(null),
    [queue, setQueue] = useState<LeitnerCardView[] | null>(null),
    [index, setIndex] = useState(0),
    [shown, setShown] = useState(false);
  const started = useRef(0),
    requestId = useRef(""),
    action = useAction(),
    card = queue?.[index];
  const reload = () => {
    cards.reload();
    due.reload();
    stats.reload();
  };
  async function review(remembered: boolean) {
    if (!card) return;
    await action.run(async () => {
      await api("/leitner/cards/" + card.id + "/review", {
        method: "POST",
        body: JSON.stringify({
          version: card.version,
          requestId: requestId.current,
          remembered,
          durationSeconds: Math.min(
            3600,
            Math.max(0, Math.round((Date.now() - started.current) / 1000)),
          ),
        }),
      });
      setIndex((i) => i + 1);
      setShown(false);
      requestId.current = randomUUID();
      started.current = Date.now();
      reload();
    });
  }
  return (
    <Screen refreshing={cards.loading} onRefresh={reload}>
      <Title>Mes révisions Leitner</Title>
      <Copy>Mémorise à ton rythme avec les offres Plus et Pro.</Copy>
      <Resource resource={cards} />
      <Notice text={action.error} error />
      <Notice text={action.notice} />
      {cards.data && (
        <>
          {stats.data && (
            <Card>
              <Title>Les cinq boîtes</Title>
              {[1, 2, 3, 4, 5].map((box) => (
                <Copy key={box}>
                  Boîte {box} ·{" "}
                  {stats.data!.boxes.find((b) => b.box === box)?._count ?? 0}{" "}
                  cartes · {stats.data!.intervals[box - 1]} jours
                </Copy>
              ))}
              <Copy>{stats.data.totalReviews} révisions enregistrées</Copy>
            </Card>
          )}
          <Card>
            <Title>Ta séance du jour</Title>
            <Resource resource={due} />
            <Copy>{due.data?.total ?? 0} cartes dues</Copy>
            {!queue ? (
              <Button
                title="Commencer une révision"
                disabled={!due.data?.items.length}
                onPress={() => {
                  setQueue(due.data!.items);
                  setIndex(0);
                  setShown(false);
                  started.current = Date.now();
                  requestId.current = randomUUID();
                }}
              />
            ) : card ? (
              <>
                <Copy>
                  Carte {index + 1} / {queue.length} · boîte {card.box}
                </Copy>
                <Text style={s.label}>{card.front}</Text>
                {shown ? (
                  <>
                    <Copy>{card.back}</Copy>
                    <Button
                      title="Je savais"
                      disabled={action.busy}
                      onPress={() => void review(true)}
                    />
                    <Button
                      title="À revoir"
                      secondary
                      disabled={action.busy}
                      onPress={() => void review(false)}
                    />
                  </>
                ) : (
                  <Button
                    title="Révéler la réponse"
                    onPress={() => setShown(true)}
                  />
                )}
                <Button
                  title="Quitter la séance"
                  secondary
                  disabled={action.busy}
                  onPress={() => setQueue(null)}
                />
              </>
            ) : (
              <>
                <Copy>Séance terminée ! Tes échéances sont enregistrées.</Copy>
                <Button
                  title="Revenir à mes cartes"
                  onPress={() => setQueue(null)}
                />
              </>
            )}
          </Card>
          <Card>
            <Title>{editing ? "Modifier une carte" : "Créer une carte"}</Title>
            <Field
              label="Recto : question"
              value={front}
              onChange={setFront}
              multiline
            />
            <Field
              label="Verso : réponse"
              value={back}
              onChange={setBack}
              multiline
            />
            <Button
              title="Enregistrer la carte"
              disabled={action.busy || !!queue || !front.trim() || !back.trim()}
              onPress={() =>
                void action.run(async () => {
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
                  reload();
                  action.setNotice("Carte enregistrée.");
                })
              }
            />
            {editing && (
              <Button
                title="Annuler la modification"
                secondary
                onPress={() => {
                  setEditing(null);
                  setFront("");
                  setBack("");
                }}
              />
            )}
          </Card>
          <Title>Ma collection</Title>
          {!cards.data.total && (
            <Copy>Crée ta première carte pour commencer.</Copy>
          )}
          {cards.data.items.map((c) => (
            <Card key={c.id}>
              <Text style={s.label}>{c.front}</Text>
              <Copy>
                Boîte {c.box} · prochaine révision{" "}
                {new Date(c.dueAt).toLocaleDateString("fr-FR")}
              </Copy>
              <Button
                title="Modifier la carte"
                secondary
                disabled={action.busy || !!queue}
                onPress={() => {
                  setEditing(c);
                  setFront(c.front);
                  setBack(c.back);
                }}
              />
              <Button
                title="Archiver la carte"
                secondary
                disabled={action.busy || !!queue}
                onPress={() =>
                  Alert.alert(
                    "Archiver cette carte ?",
                    "Son historique sera conservé.",
                    [
                      { text: "Conserver", style: "cancel" },
                      {
                        text: "Archiver",
                        style: "destructive",
                        onPress: () =>
                          void action.run(async () => {
                            await api("/leitner/cards/" + c.id, {
                              method: "DELETE",
                            });
                            reload();
                          }),
                      },
                    ],
                  )
                }
              />
            </Card>
          ))}
          <Pagination
            page={page}
            total={cards.data.total}
            size={100}
            onChange={setPage}
          />
          {stats.data && (
            <Card>
              <Title>Dernières révisions</Title>
              {stats.data.recent.map((r) => (
                <Copy key={r.id}>
                  {r.remembered ? "Retenu" : "À revoir"} ·{" "}
                  {new Date(r.createdAt).toLocaleString("fr-FR")}
                </Copy>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
