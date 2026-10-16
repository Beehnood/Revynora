"use client";
import { useEffect, useCallback, useState } from "react";
import { api, message } from "./api";
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    api<T>(path)
      .then((v) => {
        if (current) {
          setData(v);
          setError("");
        }
      })
      .catch((e) => {
        if (current) setError(message(e));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [path, revision]);
  const reload = useCallback(() => {
    setLoading(true);
    setRevision((v) => v + 1);
  }, []);
  return { data, error, loading, reload };
}
