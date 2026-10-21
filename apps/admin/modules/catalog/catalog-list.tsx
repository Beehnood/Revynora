"use client";
import { useState } from "react";
import { dateLabel } from "@/lib/presentation";
import Link from "next/link";
import type { AdminCatalogCourse, AdminPage } from "@revynora/types";
import {
  Card,
  PageHeader,
  LoadingState,
  Alert,
  FormField,
  Input,
} from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { useResource } from "@/lib/use-resource";
export function CatalogList() {
  const [page, setPage] = useState(1),
    [draft, setDraft] = useState(""),
    [search, setSearch] = useState("");
  const resource = useResource<AdminPage<AdminCatalogCourse>>(
    "/admin/catalog/courses?page=" +
      page +
      "&search=" +
      encodeURIComponent(search),
  );
  const data = resource.data;
  return (
    <>
      <PageHeader
        title="Cours"
        description="Catalogue éditorial partagé · consultation uniquement. Les contenus privés des étudiants sont exclus."
      />
      <Card>
        <form
          className="saas-actions"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(draft.trim());
            setPage(1);
          }}
        >
          <FormField
            id="catalog-search"
            label="Rechercher par titre ou matière"
          >
            <Input
              id="catalog-search"
              value={draft}
              maxLength={100}
              onChange={(e) => setDraft(e.target.value)}
            />
          </FormField>
          <Button type="submit">Rechercher les cours</Button>
        </form>
      </Card>
      {resource.loading && <LoadingState />}
      {resource.error && (
        <Alert role="alert">
          {resource.error}
          <Button variant="outline" onClick={resource.reload}>
            Réessayer le catalogue
          </Button>
        </Alert>
      )}
      {data && (
        <Card>
          <p role="status">
            {data.total} cours du catalogue{" "}
            {data.total > 1 ? "correspondent" : "correspond"} à la recherche.
          </p>
          {data.items.length === 0 ? (
            <p>
              {data.total === 0
                ? "Aucun cours du catalogue trouvé."
                : "Aucun cours sur cette page."}
            </p>
          ) : (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Cours du catalogue — tableau défilant"
            >
              <table className="admin-table">
                <caption>
                  Cours éditoriaux accessibles à tous les étudiants connectés
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Titre</th>
                    <th scope="col">Matière</th>
                    <th scope="col">Création UTC</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((course) => (
                    <tr key={course.id}>
                      <th scope="row">
                        <Link href={"/cours/" + encodeURIComponent(course.id)}>
                          {course.title}
                        </Link>
                      </th>
                      <td>{course.domain}</td>
                      <td>{dateLabel(course.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav className="saas-actions" aria-label="Pagination du catalogue">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Cours précédents
            </Button>
            <span>Page {page} · 20 cours maximum</span>
            <Button
              variant="outline"
              disabled={page * 20 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Cours suivants
            </Button>
          </nav>
        </Card>
      )}
    </>
  );
}
