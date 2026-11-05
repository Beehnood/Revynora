import { it, expect, vi } from "vitest";
import { createApiClient, RequestError, message } from "./index";
it("utilise une API configurable sans dépendance à un navigateur", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ id: "one" })));
  const client = createApiClient({
    baseUrl: "https://api.example.test/api/v1/",
    fetcher,
    credentials: "omit",
  });
  expect(await client("/users/me")).toEqual({ id: "one" });
  expect(fetcher).toHaveBeenCalledWith(
    "https://api.example.test/api/v1/users/me",
    expect.objectContaining({ credentials: "omit", cache: "no-store" }),
  );
  expect(fetcher.mock.calls[0]![1].headers["X-Revynora-Client"]).toBe("web");
});
it("conserve les erreurs HTTP et délègue la redirection au client appelant", async () => {
  const onUnauthorized = vi.fn();
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ code: "AUTH_REQUIRED", message: "Reconnectez-vous" }),
        { status: 401 },
      ),
    );
  const client = createApiClient({ fetcher, onUnauthorized });
  await expect(client("/users/me")).rejects.toMatchObject({
    code: "AUTH_REQUIRED",
    status: 401,
  });
  expect(onUnauthorized).toHaveBeenCalledOnce();
});
it("distingue réseau, JSON invalide et validation de formulaire", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(new Response("invalid", { status: 503 }))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: "Champ invalide",
          code: "VALIDATION",
          details: [{ field: "name", message: "Requis" }],
        }),
        { status: 400 },
      ),
    );
  const client = createApiClient({ fetcher });
  await expect(client("/users/me")).rejects.toMatchObject({
    code: "NETWORK",
    status: 0,
  });
  await expect(client("/users/me")).rejects.toMatchObject({
    code: "UNAVAILABLE",
    status: 503,
  });
  await expect(client("/users/me")).rejects.toMatchObject({
    code: "VALIDATION",
    details: [{ field: "name", message: "Requis" }],
  });
  expect(message(new RequestError("Message", "ERROR", 400))).toBe("Message");
  expect(message(null)).toContain("erreur");
});
it("laisse le navigateur fixer la boundary multipart sans perdre CSRF ni cookies", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "document" }));
  const body = new FormData();
  body.append(
    "file",
    new Blob(["PDF fixture"], { type: "application/pdf" }),
    "cours.pdf",
  );
  await createApiClient({ fetcher })("/documents", { method: "POST", body });
  const request = fetcher.mock.calls[0][1];
  expect(request.body).toBe(body);
  expect(request.headers["Content-Type"]).toBeUndefined();
  expect(request.headers["X-Revynora-Client"]).toBe("web");
  expect(request.credentials).toBe("same-origin");
  expect(request.cache).toBe("no-store");
});
