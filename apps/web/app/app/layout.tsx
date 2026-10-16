import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { UserProfile } from "@revynora/types";
import { StudentShell } from "@/components/learning/student-shell";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const token = jar.get("revynora_session")?.value;
  if (!token) redirect("/connexion");
  let response: Response;
  try {
    response = await fetch("http://127.0.0.1:3001/api/v1/users/me", {
      headers: { cookie: `revynora_session=${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return <Offline />;
  }
  if (response.status === 401) redirect("/connexion");
  if (!response.ok) return <Offline />;
  const user = (await response.json()) as UserProfile;
  if (user.role === "ADMIN") redirect("/admin");
  return <StudentShell user={user}>{children}</StudentShell>;
}
function Offline() {
  return (
    <main id="main" className="container section">
      <h1>Ton espace est momentanément indisponible.</h1>
      <p>
        L’API ou la base de données ne répond pas. Tes données ne sont pas
        remplacées par une démonstration.
      </p>
      <a className="button button-primary" href="/app">
        Réessayer
      </a>
    </main>
  );
}
