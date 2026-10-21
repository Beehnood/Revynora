"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- clear authenticated state after logout */
import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@revynora/ui/brand";
import { Button } from "@revynora/ui/button";
import { Alert } from "@revynora/ui";
import { api, message } from "@/lib/api";
const links = [
  { href: "/", label: "Vue générale" },
  { href: "/utilisateurs", label: "Utilisateurs" },
  { href: "/cours", label: "Cours" },
  { href: "/abonnements", label: "Abonnements" },
  { href: "/paiements", label: "Paiements" },
];
export function AdminShell({
  children,
  learningHref,
}: {
  children: React.ReactNode;
  learningHref?: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const toggle = useRef<HTMLButtonElement>(null);
  const logoutLock = useRef(false);
  return (
    <div
      className="admin-shell"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <button
        ref={toggle}
        className="button button-outline admin-menu-toggle"
        aria-expanded={open}
        aria-controls="admin-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? "Fermer le menu" : "Ouvrir le menu"}
      </button>
      <aside className={"admin-sidebar " + (open ? "is-open" : "")}>
        <Brand />
        <nav
          id="admin-navigation"
          className="admin-nav"
          aria-label="Administration"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={
                (link.href === "/" ? path === "/" : path.startsWith(link.href))
                  ? "page"
                  : undefined
              }
              onClick={() => {
                setOpen(false);
                toggle.current?.focus();
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {learningHref && (
          <a className="button button-outline" href={learningHref}>
            Mon espace pédagogique
          </a>
        )}
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            if (logoutLock.current) return;
            logoutLock.current = true;
            setBusy(true);
            setError("");
            try {
              await api("/auth/logout", { method: "POST" });
              window.location.assign("/connexion");
            } catch (e) {
              setError(message(e));
              logoutLock.current = false;
              setBusy(false);
            }
          }}
        >
          Se déconnecter
        </Button>
        {error && <Alert role="alert">{error}</Alert>}
      </aside>
      <main id="main" className="admin-main">
        {children}
      </main>
    </div>
  );
}
