import type { Metadata } from "next";
import { AuthForm } from "@/components/learning/auth-form";
export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};
export default function Login() {
  return <AuthForm />;
}
