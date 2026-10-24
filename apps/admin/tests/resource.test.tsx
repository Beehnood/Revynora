import { it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useResource } from "../lib/use-resource";
import { api } from "../lib/api";
vi.mock("../lib/api", async (original) => ({
  ...(await original<typeof import("../lib/api")>()),
  api: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
it("masque les données de la fiche précédente et ignore une réponse tardive", async () => {
  let late: (value: unknown) => void = () => {};
  vi.mocked(api)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          late = resolve;
        }),
    )
    .mockResolvedValueOnce({ name: "Bob" });
  const { result, rerender } = renderHook(
    ({ path }) => useResource<{ name: string }>(path),
    { initialProps: { path: "/admin/users/a" } },
  );
  expect(result.current.loading).toBe(true);
  rerender({ path: "/admin/users/b" });
  expect(result.current.data).toBeNull();
  await waitFor(() => expect(result.current.data?.name).toBe("Bob"));
  await act(async () => late({ name: "Alice" }));
  expect(result.current.data?.name).toBe("Bob");
});
it("signale une erreur et permet une reprise sans données périmées", async () => {
  vi.mocked(api)
    .mockRejectedValueOnce(new Error("Indisponible"))
    .mockResolvedValueOnce({ name: "Alice" });
  const { result } = renderHook(() =>
    useResource<{ name: string }>("/admin/users/a"),
  );
  await waitFor(() => expect(result.current.error).toBe("Indisponible"));
  act(() => result.current.reload());
  expect(result.current.loading).toBe(true);
  expect(result.current.error).toBe("");
  await waitFor(() => expect(result.current.data?.name).toBe("Alice"));
});
