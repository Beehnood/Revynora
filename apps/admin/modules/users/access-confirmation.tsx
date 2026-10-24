"use client";
import { useRef, useState } from "react";
import type { AdminAccessChange, AdminAccessReason } from "@revynora/types";
import { Button } from "@revynora/ui/button";
export const accessReasons: Record<AdminAccessReason, string> = {
  SECURITY_REVIEW: "Contrôle de sécurité",
  POLICY_REVIEW: "Vérification des règles d’utilisation",
  USER_REQUEST: "Demande du titulaire",
  REVIEW_COMPLETED: "Vérification terminée",
};
export function AccessConfirmation({
  name,
  disabled,
  busy,
  onCancel,
  onConfirm,
}: {
  name: string;
  disabled: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (command: AdminAccessChange) => Promise<void>;
}) {
  const [reason, setReason] = useState<AdminAccessReason | "">("");
  const [confirmed, setConfirmed] = useState(false);
  const submitting = useRef(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!reason || !confirmed || submitting.current) return;
        submitting.current = true;
        try {
          await onConfirm({ disabled, confirmed: true, reason });
        } finally {
          submitting.current = false;
        }
      }}
    >
      <fieldset disabled={busy}>
        <legend>
          {disabled ? "Suspendre" : "Réactiver"} le compte de {name}
        </legend>
        <p>
          Ne saisissez aucune donnée personnelle dans un motif. La suspension
          révoque les sessions existantes.
        </p>
        <label>
          Motif obligatoire{" "}
          <select
            autoFocus
            required
            value={reason}
            onChange={(e) => {
              const value = e.target.value;
              setReason(
                value === "SECURITY_REVIEW" ||
                  value === "POLICY_REVIEW" ||
                  value === "USER_REQUEST" ||
                  value === "REVIEW_COMPLETED"
                  ? value
                  : "",
              );
            }}
          >
            <option value="">Choisir un motif</option>
            {Object.entries(accessReasons).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          Je confirme cette action sur ce compte
        </label>
        <Button type="submit" disabled={busy || !reason || !confirmed}>
          Confirmer {disabled ? "la suspension" : "la réactivation"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
      </fieldset>
    </form>
  );
}
