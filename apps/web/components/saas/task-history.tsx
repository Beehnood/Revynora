"use client";
import { useState } from "react";
import { api, message } from "@/lib/api";
import { Alert } from "../ui";
import { Button } from "../ui/button";
type Version = {
  id: string;
  version: number;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  recordedAt: string;
};
type History = {
  items: Version[];
  total: number;
  page: number;
  pageSize: number;
};
export function TaskHistory({
  itemId,
  timeZone,
}: {
  itemId: string;
  timeZone: string;
}) {
  const [data, setData] = useState<History | null>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load(page: number) {
    setBusy(true);
    setError("");
    try {
      setData(
        await api<History>(
          "/study-plan-items/" + itemId + "/history?page=" + page,
        ),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="task-history">
      <Button
        variant="ghost"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open && !data) void load(1);
        }}
      >
        Historique de la séance
      </Button>
      {open && (
        <div aria-label="Versions de la séance">
          {busy && <p role="status">Chargement de l’historique…</p>}
          {error && (
            <Alert role="alert">
              {error}{" "}
              <Button variant="outline" onClick={() => load(data?.page ?? 1)}>
                Réessayer
              </Button>
            </Alert>
          )}
          {data?.items.map((v) => (
            <p key={v.id}>
              <strong>
                Version {v.version} · {v.title}
              </strong>
              <br />
              {new Date(v.startsAt).toLocaleString("fr-FR", {
                timeZone,
              })}{" "}
              · {v.status}
            </p>
          ))}
          {data && data.total > data.pageSize && (
            <div className="saas-actions">
              <Button
                variant="outline"
                disabled={busy || data.page === 1}
                onClick={() => load(data.page - 1)}
              >
                Version précédente
              </Button>
              <span>Page {data.page}</span>
              <Button
                variant="outline"
                disabled={busy || data.page * data.pageSize >= data.total}
                onClick={() => load(data.page + 1)}
              >
                Version suivante
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
