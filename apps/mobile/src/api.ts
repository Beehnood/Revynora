import * as SecureStore from "expo-secure-store";
import { NativeSession, apiUrl } from "./session";
const key = "revynora.session.v1";
export const session = new NativeSession(
  apiUrl(
    process.env.EXPO_PUBLIC_API_URL ??
      "https://api.revynora.watercode.dev/api/v1",
    __DEV__,
  ),
  {
    get: () => SecureStore.getItemAsync(key),
    set: (token) =>
      SecureStore.setItemAsync(key, token, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
    remove: () => SecureStore.deleteItemAsync(key),
  },
);
export const api = session.request.bind(session);
