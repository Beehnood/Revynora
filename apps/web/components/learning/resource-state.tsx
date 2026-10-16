"use client";
import { Alert, LoadingState } from "../ui";
import { Button } from "../ui/button";
export function ResourceState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  return (
    <>
      {loading && <LoadingState />}
      {error && (
        <Alert role="alert">
          <span>{error}</span>
          <Button variant="outline" onClick={retry}>
            Réessayer
          </Button>
        </Alert>
      )}
    </>
  );
}
