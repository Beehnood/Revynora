import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { LearningAccess, UserProfile } from "@revynora/types";
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
    response = await fetch(
      (process.env.API_URL ?? "http://127.0.0.1:3001") + "/api/v1/users/me",
      {
        headers: { cookie: `revynora_session=${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
  } catch {
    return <Offline />;
  }
  if (response.status === 401) redirect("/connexion");
  if (!response.ok) return <Offline />;
  const user = (await response.json()) as UserProfile;
  let accessResponse: Response;
  let access: LearningAccess;
  try {
    accessResponse = await fetch(
      (process.env.API_URL ?? "http://127.0.0.1:3001") +
        "/api/v1/learning/access",
      {
        headers: { cookie: `revynora_session=${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    access = accessResponse.ok
      ? ((await accessResponse.json()) as LearningAccess)
      : ({ allowed: false } as LearningAccess);
  } catch {
    return <Offline />;
  }
  if (accessResponse.status === 401) redirect("/connexion");
  if (!accessResponse.ok) return <Offline />;
  if (!access.allowed)
    return (
      <main id="main" className="container section">
        <h1>Accès pédagogique indisponible</h1>
        <p>
          Une attribution interne active est nécessaire pour ce compte
          administrateur.
        </p>
        <a href="/admin">Revenir à l’administration</a>
      </main>
    );
  user.learningAccess = access;
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
