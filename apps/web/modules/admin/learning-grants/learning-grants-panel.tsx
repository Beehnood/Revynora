"use client";
import { useRef, useState } from "react";
import type { AdminUser } from "@revynora/types";
import { Card, Alert, LoadingState, FormField, Input } from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { api, message, RequestError } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { dateLabel } from "@/lib/admin-presentation";
export type LearningGrant = {
  id: string;
  userId: string;
  level: "PRO";
  startsAt: string;
  expiresAt: string | null;
  provenance: string;
  justification: string;
  createdAt: string;
  issuedById: string;
  revokedAt: string | null;
  revokedById: string | null;
  revocationReason: string | null;
};
export function LearningGrantsPanel({
  user,
  onChanged,
}: {
  user: AdminUser;
  onChanged?: () => void;
}) {
  const [page, setPage] = useState(1);
  return (
    <section aria-labelledby="learning-grants-title">
      <h2 id="learning-grants-title">Droits pédagogiques internes</h2>
      <p>
        Attribution pédagogique équivalente Pro, indépendante de l’offre
        commerciale. Elle ne crée aucun paiement, abonnement commercial ou rôle
        ADMIN.
      </p>
      <GrantPage
        key={user.id + "/" + page}
        user={user}
        page={page}
        setPage={setPage}
        onChanged={onChanged}
      />
    </section>
  );
}
function GrantPage({
  user,
  page,
  setPage,
  onChanged,
}: {
  user: AdminUser;
  page: number;
  setPage: (page: number) => void;
  onChanged?: () => void;
}) {
  const resource = useResource<LearningGrant[]>(
    `/admin/users/${encodeURIComponent(user.id)}/learning-grants?page=${page}`,
  );
  const grants = resource.loading || resource.error ? null : resource.data;
  const refresh = () => {
    resource.reload();
    onChanged?.();
  };
  return (
    <>
      {resource.loading && <LoadingState />}
      {resource.error && (
        <Alert role="alert">
          {resource.error}
          <Button variant="outline" onClick={resource.reload}>
            Réessayer les attributions
          </Button>
        </Alert>
      )}
      {!resource.loading && !resource.error && !grants && (
        <p>Attributions non disponibles.</p>
      )}
      {grants && (
        <>
          {user.disabledAt ? (
            <p>
              Les nouvelles attributions sont réservées aux administrateurs
              actifs.
            </p>
          ) : (
            <IssueGrant user={user} onChanged={refresh} />
          )}
          {grants.length === 0 && <p>Aucune attribution sur cette page.</p>}
          {grants.map((grant) => (
            <GrantRecord key={grant.id} grant={grant} onChanged={refresh} />
          ))}
          <nav
            className="admin-pagination"
            aria-label="Pagination des attributions"
          >
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Attributions précédentes
            </Button>
            <span>Page {page} · 20 attributions maximum</span>
            <Button
              variant="outline"
              disabled={grants.length < 20 || page >= 10000}
              onClick={() => setPage(page + 1)}
            >
              Attributions suivantes
            </Button>
          </nav>
          <p>
            La page suivante peut être vide ; aucun total historique n’est
            fourni.
          </p>
        </>
      )}
    </>
  );
}
function IssueGrant({
  user,
  onChanged,
}: {
  user: AdminUser;
  onChanged: () => void;
}) {
  const [startsAt, setStartsAt] = useState(() =>
      new Date().toISOString().slice(0, 16),
    ),
    [expiresAt, setExpiresAt] = useState("");
  const [provenance, setProvenance] = useState(""),
    [justification, setJustification] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  return (
    <Card>
      <form
        className="admin-grant-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (lock.current || !confirmed) return;
          const start = new Date(startsAt + "Z"),
            end = expiresAt ? new Date(expiresAt + "Z") : null;
          if (
            !Number.isFinite(+start) ||
            (end &&
              (!Number.isFinite(+end) || end <= start || +end <= Date.now())) ||
            provenance.trim().length < 3 ||
            justification.trim().length < 10
          ) {
            setError(
              "Vérifiez les dates UTC, la provenance et la justification.",
            );
            return;
          }
          lock.current = true;
          setBusy(true);
          setError("");
          try {
            await api(
              `/admin/users/${encodeURIComponent(user.id)}/learning-grants`,
              {
                method: "POST",
                body: JSON.stringify({
                  startsAt: start.toISOString(),
                  ...(end ? { expiresAt: end.toISOString() } : {}),
                  provenance: provenance.trim(),
                  justification: justification.trim(),
                }),
              },
            );
            onChanged();
          } catch (e) {
            setError(message(e));
            if (e instanceof RequestError && [401, 403].includes(e.status))
              onChanged();
          } finally {
            lock.current = false;
            setBusy(false);
            setConfirmed(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <legend>Attribuer un droit pédagogique à {user.name}</legend>
          <p>
            Bénéficiaire : {user.id}. Ne saisissez aucun secret ou contenu
            pédagogique privé dans les motifs.
          </p>
          <FormField id="grant-start" label="Début (UTC)">
            <Input
              id="grant-start"
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </FormField>
          <FormField id="grant-end" label="Expiration facultative (UTC)">
            <Input
              id="grant-end"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </FormField>
          <FormField id="grant-provenance" label="Provenance">
            <Input
              id="grant-provenance"
              required
              minLength={3}
              maxLength={100}
              value={provenance}
              onChange={(e) => setProvenance(e.target.value)}
            />
          </FormField>
          <FormField id="grant-justification" label="Justification">
            <Input
              id="grant-justification"
              required
              minLength={10}
              maxLength={500}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </FormField>
          <label>
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            Je confirme l’attribution pédagogique à ce bénéficiaire
          </label>
          <Button
            type="submit"
            disabled={
              busy ||
              !confirmed ||
              provenance.trim().length < 3 ||
              justification.trim().length < 10
            }
          >
            Confirmer l’attribution pédagogique
          </Button>
          {error && (
            <Alert role="alert">
              {error}
              <Button type="button" variant="outline" onClick={onChanged}>
                Actualiser les attributions
              </Button>
            </Alert>
          )}
        </fieldset>
      </form>
    </Card>
  );
}
function GrantRecord({
  grant,
  onChanged,
}: {
  grant: LearningGrant;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    trigger = useRef<HTMLButtonElement>(null);
  return (
    <Card>
      <h3>Attribution pédagogique · {grant.id}</h3>
      <dl>
        <dt>Début UTC</dt>
        <dd>{dateLabel(grant.startsAt)}</dd>
        <dt>Expiration UTC</dt>
        <dd>
          {grant.expiresAt
            ? dateLabel(grant.expiresAt)
            : "Sans expiration enregistrée"}
        </dd>
        <dt>Provenance</dt>
        <dd>{grant.provenance}</dd>
        <dt>Justification</dt>
        <dd>{grant.justification}</dd>
        <dt>Auteur de l’attribution</dt>
        <dd>
          {grant.issuedById} · {dateLabel(grant.createdAt)}
        </dd>
        {grant.revokedAt && (
          <>
            <dt>Révocation</dt>
            <dd>
              {dateLabel(grant.revokedAt)} · {grant.revokedById} ·{" "}
              {grant.revocationReason}
            </dd>
          </>
        )}
      </dl>
      {!grant.revokedAt && (
        <button
          ref={trigger}
          className="button button-outline"
          disabled={busy}
          onClick={() => {
            setOpen(true);
            setConfirmed(false);
            setError("");
          }}
        >
          Révoquer cette attribution
        </button>
      )}
      {open && !grant.revokedAt && (
        <form
          className="admin-grant-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (lock.current || !confirmed || reason.trim().length < 10) return;
            lock.current = true;
            setBusy(true);
            setError("");
            try {
              await api(
                `/admin/learning-grants/${encodeURIComponent(grant.id)}/revoke`,
                {
                  method: "PATCH",
                  body: JSON.stringify({ reason: reason.trim() }),
                },
              );
              setOpen(false);
              onChanged();
            } catch (e) {
              setError(message(e));
              if (e instanceof RequestError && [401, 403].includes(e.status))
                onChanged();
            } finally {
              lock.current = false;
              setBusy(false);
              setConfirmed(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <legend>Confirmer la révocation de {grant.id}</legend>
            <label>
              Motif de révocation
              <input
                autoFocus
                required
                minLength={10}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                required
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{" "}
              Je confirme cette révocation pédagogique
            </label>
            <Button
              type="submit"
              disabled={busy || !confirmed || reason.trim().length < 10}
            >
              Confirmer la révocation
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Annuler la révocation
            </Button>
            {error && (
              <Alert role="alert">
                {error}
                <Button type="button" variant="outline" onClick={onChanged}>
                  Actualiser les attributions
                </Button>
              </Alert>
            )}
          </fieldset>
        </form>
      )}
    </Card>
  );
}
