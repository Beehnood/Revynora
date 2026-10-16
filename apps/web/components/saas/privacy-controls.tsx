"use client";
import { useState } from "react";
import { api, message } from "@/lib/api";
import { Card, Alert, Input, FormField } from "../ui";
import { Button } from "../ui/button";
export function PrivacyControls() {
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Card>
      <h2>Mes données personnelles</h2>
      <p>
        Télécharge tes données ou supprime ton compte. La suppression efface les
        contenus pédagogiques et anonymise les événements financiers conservés.
      </p>
      <a
        className="button button-secondary"
        href="/api/v1/privacy/export"
        download
      >
        Exporter mes données JSON
      </a>
      {error && <Alert role="alert">{error}</Alert>}
      <details>
        <summary>Supprimer définitivement mon compte</summary>
        <form
          className="saas-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/privacy/account", {
                method: "DELETE",
                body: JSON.stringify({ password, confirmation }),
              });
              // Full navigation clears all private client state after erasure.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.assign("/?compte=supprime");
            } catch (e) {
              setError(message(e));
              setBusy(false);
            }
          }}
        >
          <p>
            Cette action est définitive et résilie aussi l’abonnement de test.
          </p>
          <FormField id="delete-password" label="Mot de passe">
            <Input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <FormField id="delete-confirmation" label="Saisis SUPPRIMER">
            <Input
              id="delete-confirmation"
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </FormField>
          <Button disabled={busy || confirmation !== "SUPPRIMER"}>
            Supprimer mon compte
          </Button>
        </form>
      </details>
    </Card>
  );
}
