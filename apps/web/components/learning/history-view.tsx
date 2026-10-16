"use client";
import { useState } from "react";
import Link from "next/link";
import type { AttemptSummary, PageResult } from "@revynora/types";
import { useResource } from "@/lib/use-resource";
import { ResourceState } from "./resource-state";
import { HistoryList } from "./history-list";
import { Card, PageHeader } from "../ui";
import { Button } from "../ui/button";
export function HistoryView() {
  const [page, setPage] = useState(1);
  const state = useResource<PageResult<AttemptSummary>>(
    `/attempts?page=${page}&pageSize=5`,
  );
  return (
    <>
      <div className="heading-action">
        <PageHeader
          title="Mes tests, mon chemin parcouru."
          description="Reprends un test en cours ou retrouve le détail de chaque correction."
        />
        <Button asChild>
          <Link href="/app/diagnostic">Nouveau diagnostic</Link>
        </Button>
      </div>
      <ResourceState {...state} retry={state.reload} />
      {state.data && !state.loading && (
        <Card>
          <HistoryList items={state.data.items} />
          <div className="pagination">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Précédent
            </Button>
            <span aria-live="polite">
              Page {page} sur {Math.max(1, Math.ceil(state.data.total / 5))} ·{" "}
              {state.data.total} test(s)
            </span>
            <Button
              variant="outline"
              disabled={page * 5 >= state.data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
