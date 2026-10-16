"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Brand } from "./brand";
import { Alert, Badge, Card, EmptyState, PageHeader } from "./ui";
import { Button } from "./ui/button";
import {
  Menu,
  X,
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  Repeat2,
  CalendarDays,
  Settings,
  Users,
  CreditCard,
  Wallet,
  Sparkles,
  GraduationCap,
  ChartColumn,
  ArrowUpRight,
  ShieldCheck,
} from "./icons";
const studentLinks = [
  { name: "Tableau de bord", icon: LayoutDashboard },
  { name: "Mes matières", icon: BookOpen },
  { name: "Diagnostic", icon: ClipboardCheck },
  { name: "Révisions", icon: Repeat2 },
  { name: "Planning", icon: CalendarDays },
  { name: "Paramètres", icon: Settings },
];
const adminLinks = [
  { name: "Vue générale", icon: LayoutDashboard },
  { name: "Utilisateurs", icon: Users },
  { name: "Abonnements", icon: CreditCard },
  { name: "Paiements", icon: Wallet },
  { name: "IA & coûts", icon: Sparkles },
];
export function Dashboard({ admin = false }: { admin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const toggle = useRef<HTMLButtonElement>(null);
  const links = admin ? adminLinks : studentLinks;
  return (
    <div className="dashboard-shell">
      <aside
        className={open ? "sidebar open" : "sidebar"}
        id="dashboard-nav"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            toggle.current?.focus();
          }
        }}
      >
        <Brand />
        <span className="sidebar-label">
          {admin ? "ADMINISTRATION" : "MON ESPACE ÉTUDIANT"}
        </span>
        <nav
          aria-label={
            admin ? "Navigation administrateur" : "Navigation étudiant"
          }
        >
          {links.map((l, i) => (
            <button
              key={l.name}
              aria-current={active === i ? "page" : undefined}
              onClick={() => {
                setActive(i);
                setOpen(false);
              }}
            >
              <l.icon size={19} />
              {l.name}
              {i > 0 && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="icon-tile purple">
              {admin ? <ShieldCheck /> : <LightbulbIcon />}
            </span>
            <h3>
              {admin ? "Un socle pour la suite" : "Un petit pas chaque jour."}
            </h3>
            <p>
              {admin
                ? "Les actions de gestion seront ajoutées dans les prochaines phases."
                : "Prends le temps de comprendre. Le reste suivra."}
            </p>
          </div>
          <Link href={admin ? "/app" : "/admin"}>
            {admin ? "Voir l’espace étudiant" : "Voir la démo admin"}{" "}
            <ArrowUpRight size={15} />
          </Link>
          <Link href="/">Retour au site</Link>
        </div>
      </aside>
      <div className="dashboard-content">
        <header className="dashboard-topbar">
          <button
            ref={toggle}
            className="menu-toggle"
            aria-label={open ? "Fermer la navigation" : "Ouvrir la navigation"}
            aria-expanded={open}
            aria-controls="dashboard-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <span className="breadcrumb">
            {admin ? "Administration" : "Espace étudiant"} <span>/</span>{" "}
            {links[active].name}
          </span>
          <div className="profile">
            <span className={`avatar ${admin ? "orange" : "purple"}`}>
              {admin ? <ShieldCheck size={20} /> : <GraduationCap size={20} />}
            </span>
            <div>
              <strong>{admin ? "Administrateur" : "Visiteur"}</strong>
              <small>Profil de démonstration</small>
            </div>
          </div>
        </header>
        <main id="main" className="dashboard-main">
          <Alert>
            <Sparkles size={18} />
            <span>
              <strong>
                {admin ? "Prototype administration" : "Bienvenue dans la démo"}{" "}
                · Phase 0
              </strong>{" "}
              —{" "}
              {admin
                ? "Aucune donnée réelle ni action de gestion."
                : "Cet espace présente le futur produit. Les fonctions pédagogiques sont à venir."}
            </span>
            <Badge>Démo</Badge>
          </Alert>
          <PageHeader
            title={
              active === 0
                ? admin
                  ? "Vue d’ensemble de la plateforme"
                  : "Prêt pour ton prochain déclic ?"
                : links[active].name
            }
            description={
              admin
                ? "Le socle de votre future administration, en toute clarté."
                : "Un espace calme pour apprendre, mémoriser et avancer à ton rythme."
            }
          />
          {active === 0 ? (
            <>
              <div className="stats-grid">
                {(admin
                  ? [
                      { name: "Utilisateurs", icon: Users, tone: "blue" },
                      { name: "Abonnements", icon: CreditCard, tone: "purple" },
                      { name: "Coûts IA", icon: Sparkles, tone: "green" },
                    ]
                  : [
                      {
                        name: "Ma progression",
                        icon: ChartColumn,
                        tone: "blue",
                      },
                      { name: "Mes révisions", icon: Repeat2, tone: "green" },
                      {
                        name: "Mon forfait",
                        icon: GraduationCap,
                        tone: "purple",
                      },
                    ]
                ).map((s) => (
                  <Card className="stat-card" key={s.name}>
                    <span className={`icon-tile ${s.tone}`}>
                      <s.icon />
                    </span>
                    <div>
                      <p>{s.name}</p>
                      <strong>{admin ? "—" : "À venir"}</strong>
                      <small>
                        {admin
                          ? "Données non disponibles"
                          : "Disponible dans une prochaine phase"}
                      </small>
                    </div>
                  </Card>
                ))}
              </div>
              <div className="dashboard-grid">
                <Card className="wide-card">
                  <div className="card-heading">
                    <h2>
                      {admin
                        ? "Activité de la plateforme"
                        : "Mes révisions du jour"}
                    </h2>
                    <Badge>À venir</Badge>
                  </div>
                  <EmptyState
                    title={
                      admin
                        ? "L’histoire commence ici"
                        : "Une page blanche, plein de possibilités"
                    }
                  >
                    {admin
                      ? "Les données de la plateforme apparaîtront après la mise en place des services."
                      : "Tes prochaines révisions trouveront leur place ici. Pour le moment, découvre la méthode Revynora."}
                  </EmptyState>
                  {!admin && (
                    <Button variant="outline" asChild>
                      <Link href="/#methode">
                        Découvrir la méthode <ArrowUpRight size={16} />
                      </Link>
                    </Button>
                  )}
                </Card>
                <Card className="daily-card">
                  <span className="icon-tile purple">
                    <Sparkles />
                  </span>
                  <span className="eyebrow">
                    {admin ? "FONDATIONS" : "LE CONSEIL DU JOUR"}
                  </span>
                  <h2>
                    {admin
                      ? "Construire sur des bases solides."
                      : "Comprendre avant de mémoriser."}
                  </h2>
                  <p>
                    {admin
                      ? "Les modules de gestion, d’abonnement et de suivi des coûts ne sont pas encore connectés."
                      : "Après une lecture, ferme ton cours et explique l’idée avec tes propres mots. Un petit geste pour mieux retenir."}
                  </p>
                  <span className="decorative-spark" aria-hidden="true">
                    ✦
                  </span>
                </Card>
                <Card>
                  <div className="card-heading">
                    <h2>{admin ? "État des services" : "Mon planning"}</h2>
                    <CalendarDays size={20} />
                  </div>
                  <EmptyState
                    title={
                      admin
                        ? "Aucune télémétrie connectée"
                        : "Rien de prévu pour le moment"
                    }
                  >
                    {admin
                      ? "Cette maquette ne reflète pas la disponibilité réelle des services."
                      : "La planification des séances arrivera dans une prochaine phase."}
                  </EmptyState>
                </Card>
                <Card>
                  <div className="card-heading">
                    <h2>{admin ? "Alertes et support" : "Mes matières"}</h2>
                    <BookOpen size={20} />
                  </div>
                  <EmptyState
                    title={
                      admin
                        ? "Aucune donnée de support"
                        : "Tout commence par la curiosité"
                    }
                  >
                    {admin
                      ? "Aucune alerte réelle n’est présentée dans ce prototype."
                      : "Tes matières et tes supports de cours seront regroupés ici."}
                  </EmptyState>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <EmptyState
                title={`${links[active].name} : bientôt dans ton espace`}
              >
                Cette section est un gabarit de navigation. Aucune
                fonctionnalité métier n’est active en phase 0.
              </EmptyState>
              <Button variant="outline" onClick={() => setActive(0)}>
                Revenir à la vue générale
              </Button>
            </Card>
          )}
          <p className="dashboard-footnote">
            Revynora · Fondation UI/UX ·{" "}
            {admin
              ? "Prototype désindexé, sans authentification réelle"
              : "Démonstration non authentifiée"}
          </p>
        </main>
      </div>
    </div>
  );
}
function LightbulbIcon() {
  return <Sparkles />;
}
