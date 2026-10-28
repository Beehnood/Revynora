import Link from "next/link";
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="container section">
      <nav aria-label="Administration">
        <Link href="/admin">Administration</Link>
        {" · "}
        <Link href="/app">Mon espace pédagogique</Link>
      </nav>
      <main id="main">{children}</main>
    </div>
  );
}
