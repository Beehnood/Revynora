import { useState, useCallback, useRef } from "react";
import {
  ScrollView,
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { message, RequestError } from "@revynora/api-client";
export { Text, View, Alert };
export const colors = {
  primary: "#5738e8",
  ink: "#121839",
  muted: "#57617b",
  bg: "#f7f9fc",
  border: "#dce2ef",
  pale: "#f0ecff",
  error: "#a51432",
  success: "#087e76",
};
export function Screen({
  children,
  refreshing = false,
  onRefresh,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.screen}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Title({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={s.title}>
      {children}
    </Text>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
export function Copy({ children }: { children: React.ReactNode }) {
  return <Text style={s.copy}>{children}</Text>;
}
export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (disabled || pressed) && { opacity: 0.55 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: colors.primary }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  secure = false,
  multiline = false,
  keyboard = "default",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  multiline?: boolean;
  keyboard?: "default" | "email-address" | "numeric";
  hint?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <View style={{ gap: 6, marginVertical: 8 }}>
      <Text style={s.label}>{label}</Text>
      {hint && <Copy>{hint}</Copy>}
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure && !shown}
        autoCapitalize={
          secure || keyboard === "email-address" ? "none" : "sentences"
        }
        autoCorrect={!secure && keyboard !== "email-address"}
        keyboardType={keyboard}
        multiline={multiline}
        style={[
          s.input,
          multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
        placeholderTextColor={colors.muted}
      />
      {secure && (
        <Button
          title={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          secondary
          onPress={() => setShown(!shown)}
        />
      )}
    </View>
  );
}
export function Choices({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ marginVertical: 8, gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: value === o.value }}
            onPress={() => onChange(o.value)}
            style={[
              s.choice,
              value === o.value && {
                borderColor: colors.primary,
                backgroundColor: colors.pale,
              },
            ]}
          >
            <Text style={{ color: colors.ink }}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return text ? (
    <Text
      accessibilityRole={error ? "alert" : "text"}
      accessibilityLiveRegion="polite"
      style={[
        s.notice,
        error && { color: colors.error, borderColor: "#e8b3bf" },
      ]}
    >
      {text}
    </Text>
  ) : null;
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  return {
    busy,
    error,
    notice,
    setNotice,
    run: async (fn: () => Promise<void>) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError("");
      setNotice("");
      try {
        await fn();
      } catch (e) {
        setError(
          e instanceof RequestError && e.status === 0
            ? "Hors ligne : aucune modification confirmée. Vérifie ta connexion puis réessaie."
            : e instanceof Error && "issues" in e
              ? "Vérifie les champs du formulaire avant de continuer."
              : message(e),
        );
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
  };
}
export function useRemote<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      void api<T>(path)
        .then((result) => {
          if (active) setData(result);
        })
        .catch((e) => {
          if (active) {
            setData(null);
            setError(message(e));
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [path, version]),
  );
  return { data, loading, error, reload: () => setVersion((v) => v + 1) };
}
export function Resource({
  resource,
}: {
  resource: { loading: boolean; error: string; reload: () => void };
}) {
  return (
    <>
      {resource.loading && (
        <ActivityIndicator
          accessibilityLabel="Chargement"
          color={colors.primary}
        />
      )}
      <Notice text={resource.error} error />
      {resource.error && (
        <Button title="Réessayer" secondary onPress={resource.reload} />
      )}
    </>
  );
}
export const s = StyleSheet.create({
  screen: {
    padding: 20,
    paddingBottom: 48,
    gap: 14,
    backgroundColor: colors.bg,
    flexGrow: 1,
  },
  title: { fontSize: 28, lineHeight: 36, fontWeight: "800", color: colors.ink },
  card: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  label: { fontSize: 15, fontWeight: "700", color: colors.ink },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.ink,
    backgroundColor: "#fff",
    fontSize: 16,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
  },
  secondary: {
    backgroundColor: colors.pale,
    borderWidth: 1,
    borderColor: "#d8cfff",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    justifyContent: "center",
  },
  notice: {
    padding: 14,
    color: colors.success,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    lineHeight: 22,
  },
});
