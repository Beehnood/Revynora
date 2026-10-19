import { AdminShell } from "@/components/admin-shell";
import Link from "next/link";
import { readAdminSession } from "@/lib/admin-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = (await cookies()).get("revynora_session")?.value;
  const state = await readAdminSession(token);
  if (state === "signin") redirect("/connexion");
  if (state === "unavailable")
    return (
      <main id="main" className="container section">
        <h1>Administration indisponible</h1>
        <p>La session ne peut pas être vérifiée. Réessayez plus tard.</p>
        <Link href="/">Réessayer</Link>
      </main>
    );
  if (state === "forbidden")
    return (
      <main id="main" className="container section">
        <h1>Accès administrateur requis</h1>
        <p>Ce compte ne dispose pas des droits nécessaires.</p>
        <a href="/connexion">Changer de compte</a>
      </main>
    );
  return <AdminShell>{children}</AdminShell>;
}
