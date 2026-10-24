import { NativeSession, apiUrl, type TokenStore } from "../src/session";
const user = {
  id: "student",
  name: "Emma",
  email: "emma@example.test",
  role: "STUDENT",
  plan: "PRO",
  createdAt: "2026-10-17",
};
const token = "a".repeat(43);
const json = (data: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => data }) as Response;
let store: TokenStore,
  fetcher: jest.Mock,
  client: NativeSession,
  listener: jest.Mock;
beforeEach(() => {
  store = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  fetcher = jest.fn();
  client = new NativeSession(
    "https://api.revynora.watercode.dev/api/v1",
    store,
    fetcher,
  );
  listener = jest.fn();
  client.subscribe(listener);
});
test("release URL refuses cleartext, embedded credentials, localhost and wrong path", () => {
  expect(apiUrl("https://api.revynora.watercode.dev/api/v1", false)).toContain(
    "https:",
  );
  for (const url of [
    "http://example.test/api/v1",
    "https://localhost/api/v1",
    "https://user:secret@example.test/api/v1",
    "https://example.test/wrong",
  ])
    expect(() => apiUrl(url, false)).toThrow();
  expect(apiUrl("http://192.168.1.10:3001/api/v1", true)).toContain("http:");
});
test("login stores only token securely, re-reads current entitlements and sends bearer without cookies", async () => {
  fetcher
    .mockResolvedValueOnce(json({ user, token, expiresAt: "2026-11-01" }))
    .mockResolvedValueOnce(json(user));
  await client.authenticate("login", {
    email: user.email,
    password: "not-persisted",
  });
  expect(store.set).toHaveBeenCalledWith(token);
  expect(listener).toHaveBeenCalledWith(user);
  expect(fetcher.mock.calls[1][1]).toMatchObject({
    credentials: "omit",
    headers: {
      Authorization: "Bearer " + token,
      "X-Revynora-Client": "mobile",
    },
  });
});
test("invalid or expired token clears secure state and opens login, no cached private data", async () => {
  jest.mocked(store.get).mockResolvedValue(token);
  fetcher.mockResolvedValue(
    json({ message: "Session expirée", code: "AUTH_REQUIRED" }, 401),
  );
  await client.restore();
  expect(store.remove).toHaveBeenCalled();
  expect(listener).toHaveBeenCalledWith(null);
});
test("offline restore preserves secure token and surfaces a retryable error", async () => {
  jest.mocked(store.get).mockResolvedValue(token);
  fetcher.mockRejectedValue(new Error("offline"));
  await expect(client.restore()).rejects.toMatchObject({ status: 0 });
  expect(store.remove).not.toHaveBeenCalled();
  expect(listener).not.toHaveBeenCalled();
});
test("logout waits for server revocation before removing token", async () => {
  jest.mocked(store.get).mockResolvedValue(token);
  fetcher
    .mockResolvedValueOnce(json(user))
    .mockResolvedValueOnce(json({ ok: true }));
  await client.restore();
  await client.logout();
  expect(fetcher.mock.calls[1][0]).toContain("/auth/logout");
  expect(store.remove).toHaveBeenCalled();
  expect(listener).toHaveBeenLastCalledWith(null);
});
test("failed secure storage revokes newly issued server session", async () => {
  jest.mocked(store.set).mockRejectedValue(new Error("Keychain unavailable"));
  fetcher
    .mockResolvedValueOnce(json({ user, token, expiresAt: "2026-11-01" }))
    .mockResolvedValueOnce(json({ ok: true }));
  await expect(client.authenticate("login", {})).rejects.toThrow("Keychain");
  expect(fetcher.mock.calls[1][0]).toContain("/auth/logout");
  expect(listener).not.toHaveBeenCalled();
});
test("admin credentials cannot open the native student app", async () => {
  fetcher
    .mockResolvedValueOnce(json({ user: { ...user, role: "ADMIN" }, token }))
    .mockResolvedValueOnce(json({ ok: true }));
  await expect(client.authenticate("login", {})).rejects.toThrow(
    "administrateur",
  );
  expect(store.set).not.toHaveBeenCalled();
});
test("a delayed profile request cannot reopen a revoked native session", async () => {
  jest.mocked(store.get).mockResolvedValue(token);
  fetcher.mockResolvedValueOnce(json(user));
  await client.restore();
  listener.mockClear();
  let resolve!: (value: Response) => void;
  fetcher
    .mockImplementationOnce(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValueOnce(json({ ok: true }));
  const pending = client.refreshUser();
  await client.logout();
  resolve(json(user));
  await pending;
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenLastCalledWith(null);
});
