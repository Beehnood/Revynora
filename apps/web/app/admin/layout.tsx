import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Layout() {
  const token = (await cookies()).get("revynora_session")?.value;
  if (!token) redirect("/connexion");
  let response: Response;
  try {
    response = await fetch(
      (process.env.API_URL ?? "http://127.0.0.1:3001") + "/api/v1/users/me",
      {
        headers: { cookie: "revynora_session=" + token },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
  } catch {
    return (
      <main id="main" className="container section">
        <h1>Administration indisponible</h1>
        <p>Réessayez lorsque l’API répond.</p>
      </main>
    );
  }
  if (response.status === 401) redirect("/connexion");
  if (!response.ok)
    return (
      <main id="main">
        <h1>Administration indisponible</h1>
      </main>
    );
  const user = await response.json();
  if (user.role !== "ADMIN") redirect("/app");
  redirect(process.env.ADMIN_ORIGIN ?? "http://localhost:3002");
}
