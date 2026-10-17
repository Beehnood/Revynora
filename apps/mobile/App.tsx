import icon from "./assets/icon.png";
import { useEffect, useState } from "react";
import { AppState, Image, ActivityIndicator } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import type { UserProfile } from "@revynora/types";
import { session } from "./src/api";
import { AuthContext } from "./src/auth-context";
import type { Routes } from "./src/navigation";
import { AuthScreen } from "./src/screens/auth";
import {
  HomeScreen,
  CoursesScreen,
  CourseScreen,
  DiagnosticScreen,
  AttemptsScreen,
  AttemptScreen,
} from "./src/screens/learning";
import { LeitnerScreen } from "./src/screens/leitner";
import { PlanningScreen } from "./src/screens/planning";
import {
  ProgressScreen,
  ProfileScreen,
  SubscriptionScreen,
} from "./src/screens/account";
import {
  Screen,
  Title,
  Copy,
  Button,
  Notice,
  colors,
} from "./src/components/ui";
import { message } from "@revynora/api-client";
void SplashScreen.preventAutoHideAsync();
const Stack = createNativeStackNavigator<Routes>();
export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [onboard, setOnboard] = useState(false);
  async function restore() {
    setLoading(true);
    setError("");
    try {
      setOnboard(
        (await SecureStore.getItemAsync("revynora.onboarding.v1")) !== "done",
      );
      await session.restore();
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
      void SplashScreen.hideAsync();
    }
  }
  useEffect(() => {
    const unsubscribe = session.subscribe(setUser);
    void restore();
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (!user) return;
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void session.refreshUser().catch(() => {});
    });
    return () => listener.remove();
  }, [user?.id]);
  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      background: colors.bg,
      card: "#fff",
      text: colors.ink,
      border: colors.border,
    },
  };
  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bg }}
        edges={["top", "left", "right", "bottom"]}
      >
        {loading ? (
          <Screen>
            <ActivityIndicator
              accessibilityLabel="Ouverture de Revynora"
              color={colors.primary}
            />
          </Screen>
        ) : error ? (
          <Screen>
            <Title>Retrouvons ta connexion</Title>
            <Notice text={error} error />
            <Copy>
              Ton espace reste protégé. Aucune écriture n’est envoyée hors
              ligne.
            </Copy>
            <Button title="Réessayer" onPress={() => void restore()} />
          </Screen>
        ) : onboard ? (
          <Screen>
            <Image
              source={icon}
              style={{ width: 140, height: 140, alignSelf: "center" }}
              accessibilityLabel="Revynora"
            />
            <Title>Apprends mieux. Mémorise durablement.</Title>
            <Copy>
              Teste tes connaissances, comprends tes erreurs et retrouve tes
              révisions sur tous tes appareils.
            </Copy>
            <Copy>
              Tu choisis quand révéler les réponses et quand confirmer ton
              planning. Tes données restent privées.
            </Copy>
            <Button
              title="Commencer"
              onPress={() =>
                void SecureStore.setItemAsync("revynora.onboarding.v1", "done")
                  .then(() => setOnboard(false))
                  .catch((e) => setError(message(e)))
              }
            />
          </Screen>
        ) : !user ? (
          <AuthScreen />
        ) : (
          <AuthContext.Provider value={user}>
            <NavigationContainer theme={theme}>
              <Stack.Navigator
                screenOptions={{
                  headerTintColor: colors.primary,
                  headerBackTitle: "Retour",
                  contentStyle: { backgroundColor: colors.bg },
                }}
              >
                <Stack.Screen
                  name="Home"
                  component={HomeScreen}
                  options={{ title: "Revynora" }}
                />
                <Stack.Screen
                  name="Courses"
                  component={CoursesScreen}
                  options={{ title: "Mes cours" }}
                />
                <Stack.Screen
                  name="Course"
                  component={CourseScreen}
                  options={{ title: "Mon cours" }}
                />
                <Stack.Screen
                  name="Diagnostic"
                  component={DiagnosticScreen}
                  options={{ title: "Nouveau diagnostic" }}
                />
                <Stack.Screen
                  name="Attempts"
                  component={AttemptsScreen}
                  options={{ title: "Mes tests" }}
                />
                <Stack.Screen
                  name="Attempt"
                  component={AttemptScreen}
                  options={{ title: "Diagnostic et correction" }}
                />
                <Stack.Screen
                  name="Leitner"
                  component={LeitnerScreen}
                  options={{ title: "Révisions" }}
                />
                <Stack.Screen
                  name="Planning"
                  component={PlanningScreen}
                  options={{ title: "Planning" }}
                />
                <Stack.Screen
                  name="Progress"
                  component={ProgressScreen}
                  options={{ title: "Progression" }}
                />
                <Stack.Screen
                  name="Profile"
                  component={ProfileScreen}
                  options={{ title: "Profil et paramètres" }}
                />
                <Stack.Screen
                  name="Subscription"
                  component={SubscriptionScreen}
                  options={{ title: "Mon abonnement" }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </AuthContext.Provider>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
