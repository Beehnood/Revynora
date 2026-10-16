"use client";
import { useState } from "react";
import { courseSchema } from "@revynora/validation";
import type { CourseView, PageResult } from "@revynora/types";
import { api, message } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { ResourceState } from "./resource-state";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "../ui";
import { Button } from "../ui/button";
export function CoursesView() {
  const [page, setPage] = useState(1);
  const state = useResource<PageResult<CourseView>>(
    `/courses?page=${page}&pageSize=5`,
  );
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <>
      <div className="heading-action">
        <PageHeader
          title="Les idées à garder près de toi."
          description="Tes notes personnelles, les mini-cours de tes tests terminés et les ressources éditoriales."
        />
        <Button
          onClick={() => setShow(!show)}
          aria-expanded={show}
          aria-controls="course-form"
        >
          {show ? "Fermer le formulaire" : "Créer un cours personnel"}
        </Button>
      </div>
      {show && (
        <Card id="course-form" className="course-create">
          <h2>Un nouveau cours, à ta façon.</h2>
          <form
            noValidate
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const parsed = courseSchema.safeParse(
                Object.fromEntries(new FormData(e.currentTarget)),
              );
              if (!parsed.success) {
                setErrors(
                  Object.fromEntries(
                    parsed.error.issues.map((i) => [i.path[0], i.message]),
                  ),
                );
                return;
              }
              setErrors({});
              setError("");
              setBusy(true);
              try {
                await api("/courses", {
                  method: "POST",
                  body: JSON.stringify(parsed.data),
                });
                setShow(false);
                setPage(1);
                state.reload();
              } catch (error) {
                setError(message(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            <FormField id="title" label="Titre" error={errors.title}>
              <Input
                id="title"
                name="title"
                required
                maxLength={160}
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? "title-error" : undefined}
              />
            </FormField>
            <FormField id="course-domain" label="Domaine" error={errors.domain}>
              <Select id="course-domain" name="domain">
                {["Sciences", "Mathématiques", "Langues"].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </FormField>
            <FormField
              id="content"
              label="Contenu du cours"
              error={errors.content}
            >
              <Textarea
                id="content"
                name="content"
                rows={5}
                maxLength={10000}
                required
                aria-invalid={!!errors.content}
                aria-describedby={errors.content ? "content-error" : undefined}
              />
            </FormField>
            {error && <Alert role="alert">{error}</Alert>}
            <Button disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer mon cours"}
            </Button>
          </form>
        </Card>
      )}
      <ResourceState {...state} retry={state.reload} />
      {state.data && !state.loading && (
        <>
          {!state.data.items.length && (
            <Card>
              <EmptyState title="Tes premières idées prendront place ici">
                Crée une note personnelle ou termine un diagnostic pour
                retrouver son mini-cours.
              </EmptyState>
            </Card>
          )}
          <div className="course-list">
            {state.data.items.map((c) => (
              <Card key={c.id}>
                <div className="card-heading">
                  <Badge>{c.domain}</Badge>
                  <small>
                    {c.source === "USER"
                      ? "Cours personnel"
                      : c.source === "ADMIN"
                        ? "Ressource éditoriale"
                        : "Mini-cours après diagnostic"}
                  </small>
                </div>
                <h2>{c.title}</h2>
                <details>
                  <summary>Lire le cours</summary>
                  <p>{c.content}</p>
                </details>
              </Card>
            ))}
          </div>
          <div className="pagination">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Précédent
            </Button>
            <span>
              Page {page} sur {Math.max(1, Math.ceil(state.data.total / 5))}
            </span>
            <Button
              variant="outline"
              disabled={page * 5 >= state.data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </>
      )}
    </>
  );
}
