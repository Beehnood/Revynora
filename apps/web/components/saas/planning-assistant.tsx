"use client";
import { useRef, useState } from "react";
import { api, message } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { AvailabilityView, PlanningProposal } from "@revynora/types";
import { aiPlanningConfirmSchema } from "@revynora/validation";
import { Card, FormField, Input, Alert, LoadingState } from "../ui";
import { Button } from "../ui/button";
export function PlanningAssistant({
  timeZone,
  onApplied,
}: {
  timeZone: string;
  onApplied: () => void;
}) {
  const availability = useResource<AvailabilityView[]>("/study-availability");
  const [start, setStart] = useState(""),
    [minutes, setMinutes] = useState(120),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [proposal, setProposal] = useState<PlanningProposal | null>(null),
    [provider, setProvider] = useState(""),
    [proposalZone, setProposalZone] = useState(timeZone),
    [removing, setRemoving] = useState<string | null>(null);
  const requestId = useRef<string>("");
  const local = (date: string) =>
    new Date(date)
      .toLocaleString("sv-SE", { timeZone })
      .slice(0, 16)
      .replace(" ", "T");
  async function save(
    slots: { localStart: string; durationMinutes: number }[],
  ) {
    setBusy(true);
    setError("");
    try {
      await api("/study-availability", {
        method: "PUT",
        body: JSON.stringify({ timeZone, slots }),
      });
      availability.reload();
      setRemoving(null);
      setNotice("Disponibilités enregistrées.");
      setProposal(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <h2>Mon planning intelligent</h2>
      <p>
        Définis tes disponibilités ponctuelles pour les 30 prochains jours. Tu
        confirmes chaque proposition avant son ajout ; les séances existantes
        sont conservées.
      </p>
      {availability.loading && <LoadingState />}
      {(error || availability.error) && (
        <Alert role="alert">{error || availability.error}</Alert>
      )}
      {notice && <Alert>{notice}</Alert>}
      <h3>Mes disponibilités · {timeZone}</h3>
      {availability.data?.length === 0 && (
        <p>Aucun créneau disponible. Ajoute ta première disponibilité.</p>
      )}
      {availability.data?.map((a) => (
        <div className="saas-row" key={a.id}>
          <span>
            {new Date(a.startsAt).toLocaleString("fr-FR", { timeZone })} ·{" "}
            {Math.round((+new Date(a.endsAt) - +new Date(a.startsAt)) / 60000)}{" "}
            min
          </span>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setRemoving(a.id)}
          >
            Retirer ce créneau
          </Button>
        </div>
      ))}
      {removing && (
        <div role="group" aria-label="Confirmation de retrait">
          <p>
            Retirer cette disponibilité ? Les tâches existantes seront
            conservées.
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              save(
                (availability.data ?? [])
                  .filter((a) => a.id !== removing)
                  .map((a) => ({
                    localStart: local(a.startsAt),
                    durationMinutes: Math.round(
                      (+new Date(a.endsAt) - +new Date(a.startsAt)) / 60000,
                    ),
                  })),
              )
            }
          >
            Confirmer le retrait
          </Button>
          <Button variant="outline" onClick={() => setRemoving(null)}>
            Garder ce créneau
          </Button>
        </div>
      )}
      <form
        className="saas-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save([
            ...(availability.data ?? []).map((a) => ({
              localStart: local(a.startsAt),
              durationMinutes: Math.round(
                (+new Date(a.endsAt) - +new Date(a.startsAt)) / 60000,
              ),
            })),
            { localStart: start, durationMinutes: minutes },
          ]);
        }}
      >
        <FormField id="availability-start" label="Début de disponibilité">
          <Input
            id="availability-start"
            type="datetime-local"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </FormField>
        <FormField id="availability-minutes" label="Minutes disponibles">
          <Input
            id="availability-minutes"
            type="number"
            min={15}
            max={720}
            required
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </FormField>
        <Button disabled={busy || !availability.data}>
          Ajouter une disponibilité
        </Button>
      </form>
      <Button
        disabled={busy || !availability.data?.length}
        onClick={async () => {
          setBusy(true);
          setError("");
          setNotice("");
          setProposal(null);
          try {
            const result = await api<{
              proposal: PlanningProposal;
              provider: string;
            }>("/study-plans/ai/propose", {
              method: "POST",
              body: JSON.stringify({ timeZone }),
            });
            setProposal(result.proposal);
            setProvider(result.provider);
            setProposalZone(timeZone);
            requestId.current = crypto.randomUUID();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Traitement en cours…" : "Proposer un planning IA"}
      </Button>
      {proposal && (
        <section aria-label="Proposition de planning">
          <h3>{proposal.title}</h3>
          <p>
            {provider === "mock" ? "Simulation locale · " : "Proposition IA · "}
            {proposal.rationale}
          </p>
          <ul>
            {proposal.tasks.map((t, i) => (
              <li key={i}>
                {t.title} · {t.localStart.replace("T", " ")} ·{" "}
                {t.durationMinutes} min · priorité {t.priority}
              </li>
            ))}
          </ul>
          <p>
            Aucune séance ajoutée avant confirmation. Fuseau : {proposalZone}.
          </p>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const input = aiPlanningConfirmSchema.parse({
                  timeZone: proposalZone,
                  proposal,
                  requestId: requestId.current,
                });
                await api("/study-plans/ai/confirm", {
                  method: "POST",
                  body: JSON.stringify(input),
                });
                setProposal(null);
                onApplied();
                setNotice("Planning confirmé et enregistré.");
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmer ce planning
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setProposal(null)}
          >
            Écarter la proposition
          </Button>
        </section>
      )}
    </Card>
  );
}
