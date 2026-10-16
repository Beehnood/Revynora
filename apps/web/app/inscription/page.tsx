import type { Metadata } from "next";
import { AuthForm } from "@/components/learning/auth-form";
export const metadata: Metadata = {
  title: "Créer un compte gratuit",
  robots: { index: false, follow: false },
};
export default function Register() {
  return <AuthForm register />;
}
