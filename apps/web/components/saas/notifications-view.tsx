"use client";
import { LoadingState } from "../ui";
import { useState } from "react";
import { api, message } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { Card, PageHeader, Alert, Input, FormField, Badge } from "../ui";
import { Button } from "../ui/button";
export function NotificationsView() {
  const prefs = useResource<{ timeZone: string; remindersEnabled: boolean }>(
      "/notifications/preferences",
    ),
    inbox = useResource<{
      mode: string;
      items: {
        id: string;
        subject: string;
        body: string;
        status: string;
        createdAt: string;
      }[];
    }>("/notifications/me");
  const [enabled, setEnabled] = useState<boolean | null>(null),
    [zone, setZone] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeader
        title="Mes notifications"
        description="Des rappels utiles, seulement si tu les souhaites."
      />
      {(prefs.loading || inbox.loading) && <LoadingState />}
      {(error || prefs.error || inbox.error) && (
        <Alert role="alert">{error || prefs.error || inbox.error}</Alert>
      )}
      {notice && <Alert>{notice}</Alert>}
      {prefs.data && (
        <Card>
          <h2>Préférences de rappel</h2>
          <form
            className="saas-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("/notifications/preferences", {
                  method: "PUT",
                  body: JSON.stringify({
                    enabled: enabled ?? prefs.data!.remindersEnabled,
                    timeZone: zone ?? prefs.data!.timeZone,
                  }),
                });
                setNotice(
                  "Préférences enregistrées. Tu peux retirer ton consentement à tout moment.",
                );
                prefs.reload();
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              <input
                type="checkbox"
                checked={enabled ?? prefs.data.remindersEnabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />{" "}
              J’accepte de recevoir les rappels de mes séances par e-mail (Pro).
            </label>
            <FormField id="notification-zone" label="Fuseau horaire IANA">
              <Input
                id="notification-zone"
                value={zone ?? prefs.data.timeZone}
                onChange={(e) => setZone(e.target.value)}
              />
            </FormField>
            <Button disabled={busy}>Enregistrer mes préférences</Button>
          </form>
        </Card>
      )}
      <Card>
        <h2>Ma boîte de réception</h2>
        <p>
          {inbox.data?.mode === "local"
            ? "Mode local : les messages restent dans cette boîte, aucun e-mail externe n’est envoyé."
            : "Messages transactionnels et rappels de ton compte."}
        </p>
        {inbox.data?.items.length === 0 && <p>Aucun message pour le moment.</p>}
        {inbox.data?.items.map((m) => (
          <article className="saas-message" key={m.id}>
            <Badge>{m.status}</Badge>
            <h3>{m.subject}</h3>
            <p>{m.body}</p>
            <small>{new Date(m.createdAt).toLocaleString("fr-FR")}</small>
          </article>
        ))}
      </Card>
    </>
  );
}
