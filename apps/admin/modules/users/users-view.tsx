"use client";
import type { AdminUser, AdminPage } from "@revynora/types";
import { useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  Alert,
  Input,
  FormField,
  LoadingState,
} from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { api, message } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { AccessConfirmation } from "./access-confirmation";
export function UsersView() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  const [pending, setPending] = useState<AdminUser | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const users = useResource<AdminPage<AdminUser>>(
    "/admin/users?page=" + page + "&search=" + encodeURIComponent(search),
  );
  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description="Rechercher un compte et gérer son accès à la plateforme."
      />
      {users.loading && <LoadingState />}
      {(error || users.error) && (
        <Alert role="alert">
          {error || users.error}
          <Button variant="outline" onClick={users.reload}>
            Réessayer
          </Button>
        </Alert>
      )}
      <Card id="admin-users">
        {!users.loading && !users.error && users.data?.total === 0 && (
          <p role="status">Aucun utilisateur trouvé.</p>
        )}
        <h2>Utilisateurs</h2>
        <FormField id="admin-search" label="Rechercher par nom ou e-mail">
          <Input
            id="admin-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </FormField>
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>E-mail</th>
                <th>Rôle</th>
                <th>État</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.data?.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={"/utilisateurs/" + u.id}>{u.name}</Link>
                  </td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.disabledAt ? "Suspendu" : "Actif"}</td>
                  <td>
                    {u.role !== "ADMIN" && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setError("");
                          setPending(u);
                        }}
                      >
                        {u.disabledAt ? "Réactiver" : "Suspendre"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pending && (
          <AccessConfirmation
            key={pending.id}
            name={pending.name}
            disabled={!pending.disabledAt}
            busy={busy}
            onCancel={() => setPending(null)}
            onConfirm={async (command) => {
              setBusy(true);
              setError("");
              try {
                await api("/admin/users/" + pending.id, {
                  method: "PATCH",
                  body: JSON.stringify(command),
                });
                setPending(null);
                users.reload();
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
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
            disabled={page * 20 >= (users.data?.total ?? 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      </Card>
    </>
  );
}
