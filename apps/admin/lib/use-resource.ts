"use client";
import { useEffect, useCallback, useState } from "react";
import { api, message } from "./api";
export function useResource<T>(path: string) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    path: string;
    revision: number;
    data: T | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    let current = true;
    api<T>(path)
      .then((data) => {
        if (current) setResult({ path, revision, data, error: "" });
      })
      .catch((error) => {
        if (current)
          setResult({ path, revision, data: null, error: message(error) });
      });
    return () => {
      current = false;
    };
  }, [path, revision]);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  const active =
    result?.path === path && result.revision === revision ? result : null;
  return {
    data: active?.data ?? null,
    error: active?.error ?? "",
    loading: active === null,
    reload,
  };
}
