import { useFocusEffect } from "@react-navigation/native";
import { session } from "./api";
import { createContext, useContext, useCallback } from "react";
import type { UserProfile } from "@revynora/types";
export const AuthContext = createContext<UserProfile | null>(null);
export function useUser() {
  useFocusEffect(
    useCallback(() => {
      void session.refreshUser().catch(() => {});
    }, []),
  );
  const user = useContext(AuthContext);
  if (!user) throw new Error("Session requise");
  return user;
}
