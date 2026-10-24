import React from "react";
import { Text, AppState } from "react-native";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { session } from "../src/api";
import App from "../App";
let mockListener: (user: unknown) => void;
jest.mock("../src/api", () => ({
  session: {
    subscribe: jest.fn((fn) => {
      mockListener = fn;
      return jest.fn();
    }),
    restore: jest.fn(),
    refreshUser: jest.fn(),
  },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../src/screens/auth", () => ({
  AuthScreen: () =>
    require("react").createElement(
      require("react-native").Text,
      null,
      "Connexion étudiante",
    ),
}));
jest.mock("@react-navigation/native", () => ({
  DefaultTheme: { colors: {} },
  NavigationContainer: ({ children }: { children: React.ReactNode }) =>
    children,
  useFocusEffect: (fn: () => void) => require("react").useEffect(fn, [fn]),
}));
jest.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => ({
    Navigator: () =>
      require("react").createElement(
        require("react-native").Text,
        null,
        "Navigation étudiante",
      ),
    Screen: () => null,
  }),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue("done");
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  jest.mocked(session.restore).mockImplementation(async () => {
    mockListener(null);
  });
  jest.mocked(session.refreshUser).mockResolvedValue(undefined);
});
test("onboarding precedes login and persists only its completion flag", async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  await render(<App />);
  await screen.findByRole("button", { name: "Commencer" });
  await fireEvent.press(screen.getByRole("button", { name: "Commencer" }));
  await screen.findByText("Connexion étudiante");
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    "revynora.onboarding.v1",
    "done",
  );
});
test("offline cold start does not render cached private screens and offers a retry", async () => {
  jest.mocked(session.restore).mockRejectedValueOnce(new Error("Hors ligne"));
  await render(<App />);
  await screen.findByText("Hors ligne");
  expect(screen.queryByText("Navigation étudiante")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Réessayer" }));
  await screen.findByText("Connexion étudiante");
});
test("valid native session opens navigation and revocation returns to login", async () => {
  const user = { id: "student", name: "Emma", role: "STUDENT" };
  jest.mocked(session.restore).mockImplementation(async () => {
    mockListener(user);
  });
  await render(<App />);
  await screen.findByText("Navigation étudiante");
  await act(async () => mockListener(null));
  await screen.findByText("Connexion étudiante");
});
