import "./admin.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { readAdminSession } from "@/lib/admin-session";
import { AdminShell } from "@/components/admin/admin-shell";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-only opt-in. The existing application remains the default destination.
  const integrated = process.env.ADMIN_WEB_INTEGRATION_ENABLED === "true";
  const token = (await cookies()).get("revynora_session")?.value;
  const state = await readAdminSession(token);
  if (state === "signin")
    redirect(integrated ? "/connexion?retour=%2Fadmin" : "/connexion");
  if (state === "forbidden") redirect("/app");
  if (state === "unavailable")
    return (
      <main id="main" className="container section">
        <h1>Administration indisponible</h1>
        <p>La session ne peut pas être vérifiée. Réessayez plus tard.</p>
        <Link href="/admin">Réessayer</Link>
      </main>
    );
  if (!integrated)
    redirect(process.env.ADMIN_ORIGIN ?? "http://localhost:3002");
  return <AdminShell>{children}</AdminShell>;
}
