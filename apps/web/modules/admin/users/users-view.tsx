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
import { useResource } from "@/lib/use-resource";
import { UserAccessAction } from "./user-access-action";
export function UsersView() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description="Rechercher un compte et consulter son état administratif."
      />
      <Card>
        <FormField id="admin-search" label="Rechercher par nom ou e-mail">
          <Input
            id="admin-search"
            value={search}
            maxLength={100}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </FormField>
      </Card>
      <UsersResults
        key={page + "/" + search + "/" + revision}
        page={page}
        search={search}
        setPage={setPage}
        onChanged={() => setRevision((value) => value + 1)}
      />
    </>
  );
}
function UsersResults({
  page,
  search,
  setPage,
  onChanged,
}: {
  page: number;
  search: string;
  setPage: (page: number) => void;
  onChanged: () => void;
}) {
  const resource = useResource<AdminPage<AdminUser>>(
    "/admin/users?page=" + page + "&search=" + encodeURIComponent(search),
  );
  const data = resource.loading || resource.error ? null : resource.data;
  return (
    <>
      {resource.loading && <LoadingState />}
      {resource.error && (
        <Alert role="alert">
          {resource.error}
          <Button variant="outline" onClick={resource.reload}>
            Réessayer les utilisateurs
          </Button>
        </Alert>
      )}
      {!resource.loading && !resource.error && !data && (
        <p role="status">Utilisateurs non disponibles.</p>
      )}
      {data && (
        <Card id="admin-users">
          <p className="admin-result-count">
            {data.total} compte{data.total > 1 ? "s" : ""}
          </p>
          {data.items.length === 0 ? (
            <p role="status">
              {data.total === 0
                ? "Aucun utilisateur trouvé."
                : "Aucun utilisateur sur cette page."}
            </p>
          ) : (
            <>
              <p className="admin-scroll-hint">
                Faites défiler le tableau horizontalement pour voir le rôle et
                l’état.
              </p>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Utilisateurs — tableau défilant"
              >
                <table className="admin-table">
                  <caption>Comptes et état administratif</caption>
                  <thead>
                    <tr>
                      <th scope="col">Nom</th>
                      <th scope="col">E-mail</th>
                      <th scope="col">Rôle</th>
                      <th scope="col">État</th>
                      <th scope="col">Accès</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((u) => (
                      <tr key={u.id}>
                        <th scope="row">
                          <Link
                            href={
                              "/admin/utilisateurs/" + encodeURIComponent(u.id)
                            }
                          >
                            {u.name}
                          </Link>
                        </th>
                        <td>{u.email}</td>
                        <td>
                          {u.role === "ADMIN" ? "Administrateur" : "Étudiant"}
                        </td>
                        <td>{u.disabledAt ? "Suspendu" : "Actif"}</td>
                        <td>
                          <UserAccessAction user={u} onChanged={onChanged} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <nav
            className="saas-actions admin-pagination"
            aria-label="Pagination des utilisateurs"
          >
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Précédent
            </Button>
            <span>Page {page} · 20 comptes maximum</span>
            <Button
              variant="outline"
              disabled={page * 20 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Suivant
            </Button>
          </nav>
        </Card>
      )}
    </>
  );
}
