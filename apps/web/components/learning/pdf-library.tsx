"use client";
import { PdfDiagnostic } from "./pdf-diagnostic";
import { useEffect, useRef, useState } from "react";
import type { PdfConfiguration, PdfCourse } from "@revynora/types";
import { api, message } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { Alert, Badge, Card, FormField, Input } from "../ui";
import { Button } from "../ui/button";
import { ResourceState } from "./resource-state";
const labels: Record<string, string> = {
  UPLOADED: "Prêt à analyser",
  PROCESSING: "Analyse en cours",
  COMPLETED: "Analyse disponible",
  FAILED: "Analyse non aboutie",
};
export function PdfLibrary() {
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false);
  const config = useResource<PdfConfiguration>("/documents/config");
  const library = useResource<{ items: PdfCourse[]; total: number }>(
    `/documents?page=${page}`,
  );
  const item = library.data?.items.find((d) => d.id === selected);
  const stale = item?.canResume === true;
  const processing = library.data?.items.some((d) => d.status === "PROCESSING");
  useEffect(() => {
    if (!processing) return;
    const t = setTimeout(library.reload, 3000);
    return () => clearTimeout(t);
  }, [processing, library.data, library.reload]);
  async function action(work: () => Promise<unknown>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
      library.reload();
      config.reload();
    } catch (e) {
      setError(message(e));
      library.reload();
      config.reload();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="pdf-heading">
      <Card>
        <h2 id="pdf-heading">Apprendre à partir de mon PDF</h2>
        <p>
          Importe ton cours, sans choisir de matière. Retrouve ses chapitres,
          ses notions essentielles et une synthèse sourcée, sans estimation de
          ton niveau.
        </p>
        <p>
          PDF texte uniquement, 3 Mio et 25 pages maximum. Les PDF scannés,
          protégés ou actifs ne sont pas acceptés.
        </p>
        <p>
          Le fichier PDF brut n’est pas conservé. Le texte et l’analyse restent
          privés jusqu’à leur suppression. En lançant l’analyse, tu transmets le
          texte au fournisseur IA configuré ; évite les documents contenant des
          données sensibles et importe uniquement des contenus que tu peux
          utiliser.
        </p>
        <ResourceState {...config} retry={config.reload} />
        {config.data && (
          <>
            <p>
              {config.data.weeklyLimit === null
                ? "Analyses selon une politique d’utilisation raisonnable (20 tentatives/jour)."
                : `${config.data.used} / ${config.data.weeklyLimit} analyses utilisées cette semaine. Réinitialisation : ${new Date(config.data.resetAt).toLocaleDateString("fr-FR", { timeZone: "UTC" })} (00:00 UTC).`}
            </p>
            {!config.data.available && (
              <Alert role="status">
                Analyse IA indisponible : aucun fournisseur réel n’est
                configuré. Tu peux importer et retrouver tes documents ; aucune
                synthèse simulée ne sera affichée.
              </Alert>
            )}
          </>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const file = (form.elements.namedItem("pdf") as HTMLInputElement)
              .files?.[0];
            if (!file) return;
            if (
              file.type !== "application/pdf" ||
              !/\.pdf$/i.test(file.name) ||
              file.size > 3 * 1024 * 1024
            ) {
              setError("Choisis un PDF de 3 Mio maximum.");
              return;
            }
            void action(async () => {
              const body = new FormData();
              body.append("file", file);
              const result = await api<PdfCourse>("/documents", {
                method: "POST",
                body,
              });
              setPage(1);
              setSelected(result.id);
              form.reset();
            });
          }}
        >
          <FormField id="pdf-upload" label="Mon document PDF">
            <Input
              id="pdf-upload"
              name="pdf"
              type="file"
              accept="application/pdf,.pdf"
              required
              disabled={busy}
            />
          </FormField>
          <Button disabled={busy}>
            {busy ? "Traitement en cours…" : "Importer mon PDF"}
          </Button>
        </form>
        {error && <Alert role="alert">{error}</Alert>}
      </Card>
      <ResourceState {...library} retry={library.reload} />
      {library.data && (
        <>
          <h2>Mes documents importés</h2>
          {!library.data.items.length && (
            <p>Aucun document importé pour le moment.</p>
          )}
          <div className="course-list">
            {library.data.items.map((doc) => (
              <Card key={doc.id}>
                <h3>{doc.filename}</h3>
                <p>
                  {doc.pageCount} pages ·{" "}
                  <Badge>{labels[doc.status] ?? doc.status}</Badge>
                </p>
                <Button variant="outline" onClick={() => setSelected(doc.id)}>
                  Ouvrir {doc.filename}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Supprimer le texte et l’analyse de ce document ? Une analyse déjà utilisée reste décomptée cette semaine.",
                      )
                    )
                      void action(async () => {
                        await api(`/documents/${doc.id}`, { method: "DELETE" });
                        if (selected === doc.id) setSelected(null);
                      });
                  }}
                >
                  Supprimer {doc.filename}
                </Button>
              </Card>
            ))}
          </div>
          <div className="pagination">
            <Button
              variant="outline"
              disabled={page === 1 || busy}
              onClick={() => {
                setPage((p) => p - 1);
                setSelected(null);
              }}
            >
              Précédent
            </Button>
            <span>Page {page}</span>
            <Button
              variant="outline"
              disabled={page * 10 >= library.data.total || busy}
              onClick={() => {
                setPage((p) => p + 1);
                setSelected(null);
              }}
            >
              Suivant
            </Button>
          </div>
        </>
      )}
      {item && (
        <Card aria-live="polite">
          <h2>{item.filename}</h2>
          {item.status === "PROCESSING" && !stale ? (
            <p role="status">
              Analyse en cours. Tu peux revenir sur cette page ; l’état est
              conservé.
            </p>
          ) : (
            !item.analysis && (
              <>
                {item.status === "FAILED" && (
                  <p>
                    L’analyse a échoué, sans consommation du quota hebdomadaire.
                    Les reprises sont limitées à trois tentatives par document.
                  </p>
                )}
                <Button
                  disabled={
                    busy || !config.data?.available || item.attempts >= 3
                  }
                  onClick={() =>
                    void action(() =>
                      api(`/documents/${item.id}/analyze`, { method: "POST" }),
                    )
                  }
                >
                  {busy
                    ? "Analyse en cours…"
                    : item.status === "FAILED"
                      ? "Réessayer l’analyse"
                      : stale
                        ? "Reprendre l’analyse interrompue"
                        : "Lancer l’analyse IA"}
                </Button>
              </>
            )
          )}
          {item.analysis && (
            <PdfDiagnostic
              key={item.id}
              document={item}
              available={!!config.data?.available}
            />
          )}
        </Card>
      )}
    </section>
  );
}
