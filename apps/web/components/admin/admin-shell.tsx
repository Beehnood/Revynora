"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- clear authenticated state after logout */
import { useRef, useState } from "react";
import Link from "next/link";
import { Brand } from "@revynora/ui/brand";
import { Button } from "@revynora/ui/button";
import { Alert } from "@revynora/ui";
import { api, message } from "@/lib/api";
const future = [
  "Utilisateurs",
  "Cours",
  "Gestion commerciale",
  "Abonnements",
  "Paiements",
];
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const toggle = useRef<HTMLButtonElement>(null);
  const logoutLock = useRef(false);
  return (
    <div className="integrated-admin">
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
          aria-controls="integrated-admin-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? "Fermer le menu" : "Ouvrir le menu"}
        </button>
        <aside className={"admin-sidebar " + (open ? "is-open" : "")}>
          <Brand />
          <nav
            id="integrated-admin-navigation"
            className="admin-nav"
            aria-label="Administration"
          >
            <Link
              href="/admin"
              aria-current="page"
              onClick={() => {
                setOpen(false);
                toggle.current?.focus();
              }}
            >
              Vue générale
            </Link>
            {future.map((label) => (
              <span
                key={label}
                aria-disabled="true"
                className="admin-future-route"
              >
                {label}
                <small>Bientôt</small>
              </span>
            ))}
          </nav>
          <Link className="button button-outline" href="/app">
            Mon espace pédagogique
          </Link>
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
    </div>
  );
}
