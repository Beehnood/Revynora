import * as SecureStore from "expo-secure-store";
import { session } from "../src/api";
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
}));
test("the production storage adapter uses device-only keychain storage and deletes it on revocation", async () => {
  const token = "s".repeat(43),
    user = {
      id: "u",
      name: "Emma",
      email: "e@example.test",
      role: "STUDENT",
      plan: "PRO",
      createdAt: "2026-10-17",
    };
  const fetcher = jest
    .spyOn(global, "fetch")
    .mockImplementation(
      async (input) =>
        ({
          ok: true,
          status: 200,
          json: async () =>
            String(input).endsWith("/auth/mobile/login")
              ? { user, token, expiresAt: "2027-01-01" }
              : String(input).endsWith("/auth/logout")
                ? { ok: true }
                : user,
        }) as Response,
    );
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
  const unsubscribe = session.subscribe(jest.fn());
  await session.authenticate("login", {
    email: user.email,
    password: "not-saved",
  });
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    "revynora.session.v1",
    token,
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  );
  await session.logout();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
    "revynora.session.v1",
  );
  unsubscribe();
  fetcher.mockRestore();
});
