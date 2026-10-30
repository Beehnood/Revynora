"use client";
import { useRef, useState } from "react";
import type { AdminUser } from "@revynora/types";
import { Alert } from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { api, message, RequestError } from "@/lib/api";
import { AccessConfirmation } from "./access-confirmation";
export function UserAccessAction({
  user,
  onChanged,
}: {
  user: AdminUser;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  if (user.role === "ADMIN") return null;
  return (
    <div className="admin-user-action">
      <button
        ref={trigger}
        className="button button-outline"
        disabled={busy}
        onClick={() => {
          setError("");
          setPending(true);
        }}
      >
        {user.disabledAt ? "Réactiver" : "Suspendre"}
      </button>
      {error && (
        <Alert role="alert">
          {error}
          <Button variant="outline" onClick={onChanged}>
            Actualiser l’état du compte
          </Button>
        </Alert>
      )}
      {pending && (
        <AccessConfirmation
          name={user.name}
          disabled={!user.disabledAt}
          busy={busy}
          onCancel={() => {
            setPending(false);
            trigger.current?.focus();
          }}
          onConfirm={async (command) => {
            setBusy(true);
            setError("");
            try {
              await api("/admin/users/" + encodeURIComponent(user.id), {
                method: "PATCH",
                body: JSON.stringify(command),
              });
              setPending(false);
              onChanged();
            } catch (e) {
              setError(message(e));
              if (e instanceof RequestError && [401, 403].includes(e.status))
                onChanged();
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}
