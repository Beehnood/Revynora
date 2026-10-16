"use client";
import { createContext, useContext, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { UserProfile } from "@revynora/types";
import { Brand } from "../brand";
import {
  Menu,
  X,
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Settings,
  Repeat2,
  CalendarDays,
  ArrowUpRight,
} from "../icons";
import { History, LogOut } from "lucide-react";
import { Badge, Alert } from "../ui";
import { api, message } from "@/lib/api";
const UserContext = createContext<UserProfile | null>(null);
export function useStudent() {
  const user = useContext(UserContext);
  if (!user) throw new Error("Student shell required");
  return user;
}
const links = [
  { name: "Tableau de bord", href: "/app", icon: LayoutDashboard },
  { name: "Nouveau diagnostic", href: "/app/diagnostic", icon: ClipboardCheck },
  { name: "Mes tests", href: "/app/historique", icon: History },
  { name: "Mes cours", href: "/app/cours", icon: BookOpen },
  { name: "Mon profil", href: "/app/profil", icon: Settings },
];
export function StudentShell({
  user,
  children,
}: {
  user: UserProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <UserContext.Provider value={user}>
      <div className="dashboard-shell">
        <aside
          id="student-nav"
          className={open ? "sidebar open" : "sidebar"}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              toggle.current?.focus();
            }
          }}
        >
          <Brand />
          <span className="sidebar-label">MON ESPACE ÉTUDIANT</span>
          <nav aria-label="Navigation étudiant">
            {links.map((l) => (
              <Link
                href={l.href}
                key={l.href}
                aria-current={pathname === l.href ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <l.icon size={19} />
                {l.name}
              </Link>
            ))}
            <span className="nav-future">
              <Repeat2 size={19} /> Révisions <small>À venir</small>
            </span>
            <span className="nav-future">
              <CalendarDays size={19} /> Planning <small>À venir</small>
            </span>
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-tip">
              <Badge>FREE</Badge>
              <h3>Chaque essai te fait avancer.</h3>
              <p>
                Un test pour découvrir ce que tu sais, un cours pour aller plus
                loin.
              </p>
            </div>
            <Link href="/">
              Retour au site <ArrowUpRight size={15} />
            </Link>
            <button
              className="logout"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/auth/logout", { method: "POST" });
                  router.replace("/connexion");
                  router.refresh();
                } catch (e) {
                  setError(message(e));
                  setBusy(false);
                }
              }}
            >
              <LogOut size={16} />
              {busy ? "Déconnexion…" : "Me déconnecter"}
            </button>
          </div>
        </aside>
        <div className="dashboard-content">
          <header className="dashboard-topbar">
            <button
              ref={toggle}
              className="menu-toggle"
              aria-label={
                open ? "Fermer la navigation" : "Ouvrir la navigation"
              }
              aria-controls="student-nav"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
            <span className="breadcrumb">
              Espace étudiant <span>/</span>{" "}
              {links.find((l) => l.href === pathname)?.name ?? "Mon diagnostic"}
            </span>
            <div className="profile">
              <span className="avatar purple">
                <GraduationCap size={20} />
              </span>
              <div>
                <strong>{user.name}</strong>
                <small>Étudiant · FREE</small>
              </div>
            </div>
          </header>
          <main id="main" className="dashboard-main">
            {error && <Alert role="alert">{error}</Alert>}
            {children}
            <p className="dashboard-footnote">
              Revynora · Ton espace d’apprentissage privé · Phase 1
            </p>
          </main>
        </div>
      </div>
    </UserContext.Provider>
  );
}
