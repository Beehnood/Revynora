"use client";
import { useRef, useState } from "react";
import { api, message, RequestError } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import {
  Card,
  PageHeader,
  Alert,
  Input,
  FormField,
  LoadingState,
} from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { dateLabel, money } from "@/lib/admin-presentation";
const features = ["leitner", "planning", "reminders"] as const;
const featureLabels = {
  leitner: "Révisions Leitner",
  planning: "Planning",
  reminders: "Rappels facultatifs",
};
type Version = {
  basedOnVersionId?: string | null;
  id: string;
  number: number;
  basedOnRevision: number;
  name: string;
  priceCents: number;
  currency: string;
  interval: string;
  active: boolean;
  features: string[];
  reason: string;
  state: string;
  bindings: { priceId: string; environment: string }[];
};
type Offer = {
  id: string;
  code: string;
  revision: number;
  currentVersionId: string | null;
  name: string;
  priceCents: number;
  currency: string;
  interval: string;
  active: boolean;
  versions: Version[];
};
type Audit = {
  id: string;
  actorId: string;
  action: string;
  versionId: string;
  beforeVersionId: string | null;
  reason: string;
  createdAt: string;
};
export function CommercialPanel() {
  const offers = useResource<Offer[]>("/admin/commercial/offers");
  const [historyRevision, setHistoryRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const visible = !offers.loading && !offers.error ? offers.data : null;
  const reload = () => {
    offers.reload();
    setHistoryRevision((value) => value + 1);
  };
  return (
    <div className="admin-commercial">
      <PageHeader
        title="Gestion commerciale"
        description="Versions des offres pour les nouvelles souscriptions. Les contrats existants et les droits internes restent préservés."
      />
      <p>
        Cette gestion nécessite une permission explicite. Une offre retirée
        reste utilisable par ses contrats existants. Stripe est limité au mode
        test.
      </p>
      {offers.loading && <LoadingState />}
      {offers.error && (
        <Alert role="alert">
          {offers.error}
          <Button onClick={offers.reload}>Réessayer</Button>
        </Alert>
      )}
      {!offers.loading && !offers.error && !visible && (
        <p>Catalogue non disponible.</p>
      )}
      {visible?.length === 0 && <p>Aucune offre disponible.</p>}
      {visible?.map((o) => (
        <Card key={o.id}>
          <h2>
            {o.code} · {o.name}
          </h2>
          <p>
            {money(o.priceCents, o.currency)} · {o.interval} ·{" "}
            {o.active ? "Disponible" : "Retirée des nouvelles ventes"} ·
            révision {o.revision}
          </p>
          <Button onClick={() => setSelected(selected === o.id ? null : o.id)}>
            Préparer une nouvelle version {o.code}
          </Button>
          {selected === o.id && (
            <DraftForm
              offer={o}
              onDenied={reload}
              onSaved={() => {
                setSelected(null);
                reload();
              }}
            />
          )}
          <h3>Versions et comparaison</h3>
          {o.versions.length === 0 && (
            <p>Catalogue historique : aucune version publiée.</p>
          )}
          {o.versions.map((v) => (
            <VersionReview
              key={v.id}
              offer={o}
              version={v}
              reload={() => {
                reload();
              }}
            />
          ))}
        </Card>
      ))}
      {visible && <CommercialHistory key={historyRevision} />}
    </div>
  );
}
function CommercialHistory() {
  const [page, setPage] = useState(1);
  return <HistoryPage key={page} page={page} setPage={setPage} />;
}
function HistoryPage({
  page,
  setPage,
}: {
  page: number;
  setPage: (page: number) => void;
}) {
  const history = useResource<Audit[]>(
    "/admin/commercial/history?page=" + page,
  );
  const rows = !history.loading && !history.error ? history.data : null;
  return (
    <Card>
      <h2>Historique commercial</h2>
      {history.loading && <LoadingState />}
      {history.error && (
        <Alert role="alert">
          {history.error}
          <Button onClick={history.reload}>Réessayer l’historique</Button>
        </Alert>
      )}
      {!history.loading && !history.error && !rows && (
        <p>Historique non disponible.</p>
      )}
      {rows && (
        <>
          {rows.length === 0 && <p>Aucun événement sur cette page.</p>}
          {rows.map((a) => (
            <p key={a.id}>
              {a.action} · {dateLabel(a.createdAt)} · auteur {a.actorId} ·
              version {a.versionId} · {a.reason}
            </p>
          ))}
          <nav
            className="admin-pagination"
            aria-label="Pagination de l’historique commercial"
          >
            <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Historique précédent
            </Button>
            <span>Page {page}</span>
            <Button
              disabled={rows.length < 20 || page >= 10000}
              onClick={() => setPage(page + 1)}
            >
              Historique suivant
            </Button>
          </nav>
          <p>20 événements maximum par page ; la suivante peut être vide.</p>
        </>
      )}
    </Card>
  );
}
function DraftForm({
  offer: o,
  onSaved,
  onDenied,
}: {
  offer: Offer;
  onDenied: () => void;
  onSaved: () => void;
}) {
  const initial = o.versions.find((v) => v.id === o.currentVersionId);
  const [name, setName] = useState(o.name),
    [amount, setAmount] = useState(String(o.priceCents)),
    [active, setActive] = useState(o.active),
    [chosen, setChosen] = useState<string[]>(
      initial?.features ??
        (o.code === "PRO"
          ? [...features]
          : o.code === "PLUS"
            ? ["leitner"]
            : []),
    ),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    prefix = "draft-" + o.id;
  return (
    <form
      className="admin-commercial-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError("");
        try {
          await api("/admin/commercial/offers/" + o.id + "/drafts", {
            method: "POST",
            body: JSON.stringify({
              expectedRevision: o.revision,
              name,
              priceCents: Number(amount),
              currency: "eur",
              interval: o.code === "FREE" ? "none" : "month",
              active,
              features: chosen,
              reason,
            }),
          });
          onSaved();
        } catch (e) {
          setError(message(e));
          if (e instanceof RequestError && [401, 403].includes(e.status))
            onDenied();
        } finally {
          lock.current = false;
          setBusy(false);
        }
      }}
    >
      <FormField id={prefix + "-name"} label="Nom de l’offre">
        <Input
          id={prefix + "-name"}
          value={name}
          maxLength={80}
          required
          onChange={(e) => setName(e.target.value)}
        />
      </FormField>
      <FormField id={prefix + "-price"} label="Prix en centimes d’euro">
        <Input
          id={prefix + "-price"}
          type="number"
          min={o.code === "FREE" ? 0 : 1}
          max={1000000}
          step={1}
          disabled={o.code === "FREE"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </FormField>
      <label>
        <input
          type="checkbox"
          checked={active}
          disabled={o.code === "FREE"}
          onChange={(e) => setActive(e.target.checked)}
        />{" "}
        Disponible pour les nouvelles souscriptions
      </label>
      <fieldset>
        <legend>Fonctionnalités contractuelles</legend>
        {features.map((f) => (
          <label key={f}>
            <input
              type="checkbox"
              checked={chosen.includes(f)}
              onChange={(e) =>
                setChosen(
                  e.target.checked
                    ? [...chosen, f]
                    : chosen.filter((x) => x !== f),
                )
              }
            />
            {featureLabels[f]}
          </label>
        ))}
      </fieldset>
      <FormField id={prefix + "-reason"} label="Motif administratif">
        <Input
          id={prefix + "-reason"}
          value={reason}
          required
          minLength={10}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
        />
      </FormField>
      {error && (
        <Alert role="alert">
          {error}
          <Button type="button" onClick={onDenied}>
            Actualiser le catalogue
          </Button>
        </Alert>
      )}
      <Button type="submit" disabled={busy}>
        Créer le brouillon
      </Button>
    </form>
  );
}
function VersionReview({
  offer: o,
  version: v,
  reload,
}: {
  offer: Offer;
  version: Version;
  reload: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false),
    [priceId, setPriceId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const current = o.versions.find((x) => x.id === v.basedOnVersionId);
  async function run(action: "publish" | "verify-price") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api("/admin/commercial/versions/" + v.id + "/" + action, {
        method: "POST",
        body: JSON.stringify(
          action === "publish"
            ? { expectedRevision: v.basedOnRevision, confirmVersionId: v.id }
            : { priceId },
        ),
      });
      setConfirmed(false);
      reload();
    } catch (e) {
      setError(message(e));
      if (e instanceof RequestError && [401, 403].includes(e.status)) reload();
    } finally {
      lock.current = false;
      setBusy(false);
      setConfirmed(false);
    }
  }
  return (
    <details className="admin-commercial-version">
      <summary>
        Version {v.number} ·{" "}
        {v.state === "DRAFT" ? "Brouillon" : "Publiée, immuable"}
        {v.id === o.currentVersionId ? " · actuelle" : ""}
      </summary>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Conditions commerciales comparées"
      >
        <table>
          <caption>Comparaison avec la version de départ</caption>
          <thead>
            <tr>
              <th scope="col">Condition</th>
              <th scope="col">Avant</th>
              <th scope="col">Cette version</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Nom</th>
              <td>{current?.name ?? "Catalogue initial"}</td>
              <td>{v.name}</td>
            </tr>
            <tr>
              <th scope="row">Prix</th>
              <td>
                {current
                  ? `${current.priceCents} ${current.currency} / ${current.interval}`
                  : "Version de départ non disponible"}
              </td>
              <td>
                {v.priceCents} {v.currency} / {v.interval}
              </td>
            </tr>
            <tr>
              <th scope="row">Vente</th>
              <td>
                {current
                  ? current.active
                    ? "Active"
                    : "Retirée"
                  : "Non disponible"}
              </td>
              <td>{v.active ? "Active" : "Retirée"}</td>
            </tr>
            <tr>
              <th scope="row">Fonctionnalités</th>
              <td>{current?.features.join(", ") || "Socle historique"}</td>
              <td>{v.features.join(", ") || "Socle Free"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Motif : {v.reason}</p>
      {v.bindings.map((b) => (
        <p key={b.priceId}>
          Prix fournisseur vérifié : {b.priceId} · {b.environment}
        </p>
      ))}
      {v.state === "DRAFT" && (
        <>
          <FormField
            id={"price-" + v.id}
            label="Identifiant d’un prix Stripe test existant"
          >
            <Input
              id={"price-" + v.id}
              value={priceId}
              onChange={(e) => setPriceId(e.target.value)}
            />
          </FormField>
          <Button
            disabled={busy || !priceId || v.bindings.length > 0}
            onClick={() => void run("verify-price")}
          >
            Vérifier le prix existant
          </Button>
          <p>
            Aucun prix Stripe n’est créé ou modifié. La publication conserve les
            anciennes conditions des contrats existants.
          </p>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            Je confirme la publication de la version {v.number} pour les
            nouvelles souscriptions.
          </label>
          <Button
            disabled={busy || !confirmed || v.basedOnRevision !== o.revision}
            onClick={() => void run("publish")}
          >
            Publier la version {v.number}
          </Button>
          {v.basedOnRevision !== o.revision && (
            <p role="status">
              Le catalogue a changé. Préparez un nouveau brouillon.
            </p>
          )}
        </>
      )}
      {error && (
        <Alert role="alert">
          {error}
          <Button onClick={reload}>Actualiser le catalogue</Button>
        </Alert>
      )}
    </details>
  );
}
