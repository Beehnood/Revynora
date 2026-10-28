"use client";
import { dateLabel } from "@/lib/admin-presentation";
import Link from "next/link";
import type { AdminCatalogCourseDetail } from "@revynora/types";
import { Card, PageHeader, LoadingState, Alert } from "@revynora/ui";
import { Button } from "@revynora/ui/button";
import { useResource } from "@/lib/use-resource";
export function CatalogDetail({ id }: { id: string }) {
  const resource = useResource<AdminCatalogCourseDetail>(
    "/admin/catalog/courses/" + encodeURIComponent(id),
  );
  const course = resource.loading || resource.error ? null : resource.data;
  return (
    <>
      <Link href="/admin/cours">Retour aux cours</Link>
      <PageHeader
        title="Fiche du cours"
        description="Consultation du catalogue éditorial. Aucun contenu privé ni donnée d’apprentissage individuelle."
      />
      {resource.loading && <LoadingState />}
      {resource.error && (
        <Alert role="alert">
          {resource.error}
          <Button variant="outline" onClick={resource.reload}>
            Réessayer le cours
          </Button>
        </Alert>
      )}
      {!resource.loading && !resource.error && !course && (
        <p role="status">Cours non disponible.</p>
      )}
      {course && (
        <Card>
          <h2>{course.title}</h2>
          <dl>
            <dt>Identifiant</dt>
            <dd>{course.id}</dd>
            <dt>Matière</dt>
            <dd>{course.domain}</dd>
            <dt>Origine</dt>
            <dd>Catalogue éditorial</dd>
            <dt>Création UTC</dt>
            <dd>{dateLabel(course.createdAt)}</dd>
          </dl>
          <h3>Contenu</h3>
          {course.content ? (
            <div className="catalog-content">{course.content}</div>
          ) : (
            <p>Aucun contenu disponible.</p>
          )}
        </Card>
      )}
    </>
  );
}
