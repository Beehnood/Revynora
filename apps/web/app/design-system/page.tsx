import type { Metadata } from "next";
import { PublicNav } from "@/components/public-nav";
import { DemoForm } from "@/components/demo-form";
import { Brand } from "@/components/brand";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Separator,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  subjects,
  statusIcons,
  GraduationCap,
  Users,
  ShieldCheck,
} from "@/components/icons";
export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};
export default function DesignSystem() {
  return (
    <>
      <PublicNav />
      <main id="main" className="container gallery">
        <PageHeader
          title="Un langage visuel pour apprendre."
          description="Identité Revynora · Composants et états de référence · Phase 0"
        />
        <Card>
          <h2>Identité</h2>
          <Brand />
          <div className="gallery-row">
            <a href="/brand/logo-mark.svg" download className="text-link">
              Télécharger le symbole SVG
            </a>
            <a href="/brand/logo-light.svg" download className="text-link">
              Logo clair
            </a>
            <a href="/brand/logo-dark.svg" download className="text-link">
              Logo sombre
            </a>
            <a href="/brand/app-icon.svg" download className="text-link">
              Icône application
            </a>
            <a href="/brand/icons.svg" download className="text-link">
              Sprite d’icônes SVG
            </a>
          </div>
        </Card>
        <Card>
          <h2>Matières</h2>
          <div className="gallery-row">
            {subjects.map((s) => (
              <div className="subject" key={s.name}>
                <span className={`icon-tile ${s.tone}`}>
                  {s.icon ? <s.icon /> : <i>{s.glyph}</i>}
                </span>
                {s.name}
              </div>
            ))}
          </div>
          <Separator />
          <h2>Rôles et statuts</h2>
          <div className="gallery-row">
            {[
              { name: "Étudiant", icon: GraduationCap, tone: "purple" },
              { name: "Enseignant", icon: Users, tone: "green" },
              { name: "Admin", icon: ShieldCheck, tone: "orange" },
              ...statusIcons,
            ].map((s) => (
              <div className="subject" key={s.name}>
                <span className={`icon-tile ${s.tone}`}>
                  <s.icon />
                </span>
                {s.name}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2>Boutons et états</h2>
          <div className="gallery-row">
            <Button>Principal</Button>
            <Button variant="outline">Secondaire</Button>
            <Button variant="ghost">Discret</Button>
            <Button disabled>Indisponible</Button>
            <Badge>À venir</Badge>
          </div>
          <EmptyState title="Aucun élément">Exemple d’état vide.</EmptyState>
          <LoadingState />
          <Separator />
          <ErrorState />
        </Card>
        <Card>
          <h2>Formulaire de démonstration</h2>
          <DemoForm />
        </Card>
      </main>
    </>
  );
}
