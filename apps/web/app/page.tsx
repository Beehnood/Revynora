import Link from "next/link";
import { PublicNav } from "@/components/public-nav";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ClipboardCheck,
  GraduationCap,
  Lightbulb,
  Repeat2,
  Sparkles,
  subjects,
} from "@/components/icons";
const steps = [
  {
    icon: ClipboardCheck,
    title: "Teste tes connaissances",
    text: "Cinq questions pour repérer tes acquis et les notions à approfondir.",
    label: "01 · Tester",
  },
  {
    icon: GraduationCap,
    title: "Comprends chaque réponse",
    text: "Une correction expliquée pour transformer tes erreurs en déclics.",
    label: "02 · Comprendre",
  },
  {
    icon: BookOpen,
    title: "Consolide tes apprentissages",
    text: "Un mini-cours et ton historique pour retrouver l’essentiel.",
    label: "03 · Apprendre",
  },
];
export default function Home() {
  return (
    <>
      <PublicNav />
      <main id="main">
        <section className="hero container">
          <div className="hero-copy">
            <Badge>
              <span className="status-dot" /> TON COMPAGNON D’APPRENTISSAGE
            </Badge>
            <h1>
              Apprends mieux.
              <br />
              <span>
                Mémorise
                <br className="desktop-break" /> durablement.
              </span>
            </h1>
            <p>
              Moins de doutes, plus de déclics. Diagnostics, corrections et
              mini-cours : retrouve tout ce qu’il te faut pour avancer
              sereinement dans tes études.
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link href="/inscription">
                  Créer mon compte gratuit <ArrowRight size={18} />
                </Link>
              </Button>
              <a className="text-link" href="#methode">
                Découvrir la méthode <ArrowUpRight size={17} />
              </a>
            </div>
            <div className="hero-note">
              <Check size={16} /> Compte FREE <span>·</span> Sans carte bancaire{" "}
              <span>·</span> Espace privé
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Illustration du futur espace d’apprentissage"
          >
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="floating-chip chip-top">
              <span className="icon-tile purple">
                <GraduationCap />
              </span>
              <div>
                <strong>Chaque petit pas compte</strong>
                <small>Un apprentissage à ton rythme</small>
              </div>
              <Sparkles size={18} />
            </div>
            <div className="learning-board">
              <div className="board-top">
                <Brand compact />
                <span className="board-dots">•••</span>
              </div>
              <div className="board-grid">
                <div className="book-illustration">
                  <BookOpen size={92} strokeWidth={1} />
                  <span className="spark spark-one">✦</span>
                  <span className="spark spark-two">✦</span>
                </div>
                <div className="board-lines">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="diagnostic-preview">
                <span className="eyebrow">APERÇU DU DIAGNOSTIC</span>
                <h3>
                  Et si on commençait
                  <br />
                  par ce que tu sais déjà ?
                </h3>
                <div className="preview-meta">
                  <span>Les cellules</span>
                  <span>Débutant</span>
                </div>
                <div className="preview-bottom">
                  <span>5 questions progressives</span>
                  <span className="round-arrow">
                    <ArrowRight size={18} />
                  </span>
                </div>
              </div>
            </div>
            <div className="floating-chip chip-bottom">
              <span className="icon-tile green">
                <Lightbulb />
              </span>
              <div>
                <strong>Le déclic, à ta façon.</strong>
                <small>Tester. Comprendre. Retenir.</small>
              </div>
            </div>
            <div className="art-caption">
              Illustration du produit à venir · aperçu statique
            </div>
          </div>
        </section>
        <div className="trust-strip">
          <div className="container">
            <span>
              <GraduationCap /> Pensé pour les étudiants
            </span>
            <span>
              <BookOpen /> Toutes tes matières, un seul espace
            </span>
            <span>
              <Repeat2 /> La mémoire se cultive
            </span>
          </div>
        </div>
        <section id="methode" className="container section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">UNE MÉTHODE, TROIS ÉTAPES</span>
              <h2>
                Comprendre aujourd’hui.
                <br />
                S’en souvenir demain.
              </h2>
            </div>
            <p>
              Un cadre simple pour transformer tes efforts
              <br />
              en apprentissages qui restent.
            </p>
          </div>
          <div className="steps-grid">
            {steps.map((s) => (
              <Card key={s.title} className="step-card">
                <span className="icon-tile purple">
                  <s.icon />
                </span>
                <small>{s.label}</small>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <Badge>Disponible</Badge>
              </Card>
            ))}
          </div>
        </section>
        <section id="matieres" className="subjects-section">
          <div className="container">
            <span className="eyebrow">LA CURIOSITÉ N’A PAS DE FRONTIÈRES</span>
            <h2>À chaque matière, son déclic.</h2>
            <p>Un univers pour toutes les façons d’apprendre.</p>
            <div className="subjects-grid">
              {subjects.map((s) => (
                <div className="subject" key={s.name}>
                  <span className={`icon-tile ${s.tone}`}>
                    {s.icon ? <s.icon /> : <i>{s.glyph}</i>}
                  </span>
                  <span>{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section id="tarifs" className="container section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">UN ESPACE POUR GRANDIR</span>
              <h2>Ton rythme. Ton choix.</h2>
            </div>
            <p>
              Trois offres mensuelles, sans période d’essai.
              <br />
              Facturation de test ou simulation locale, sans prélèvement réel.
            </p>
          </div>
          <div className="pricing-grid">
            {[
              {
                name: "Free",
                price: "0 €",
                text: "Pour découvrir la méthode",
                items: [
                  "Diagnostics et corrections",
                  "Historique et mini-cours",
                ],
              },
              {
                name: "Plus",
                price: "2,50 €",
                text: "Pour aller un peu plus loin",
                items: ["Tout le forfait Free", "Cartes et révisions Leitner"],
              },
              {
                name: "Pro",
                price: "5 €",
                text: "Pour organiser ta réussite",
                items: [
                  "Tout le forfait Plus",
                  "Planning et rappels facultatifs",
                ],
              },
            ].map((p, i) => (
              <Card
                key={p.name}
                className={i === 1 ? "price-card featured" : "price-card"}
              >
                <div className="price-title">
                  <h3>{p.name}</h3>
                  <Badge>
                    {i === 0
                      ? "Disponible"
                      : i === 1
                        ? "Pour progresser"
                        : "Pour s’organiser"}
                  </Badge>
                </div>
                <p>{p.text}</p>
                <div className="price">
                  {p.price}
                  <small>{i > 0 ? " / mois" : ""}</small>
                </div>
                <ul>
                  {p.items.map((item) => (
                    <li key={item}>
                      <Check size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
                {i === 0 ? (
                  <Button asChild variant="outline">
                    <Link href="/inscription">Créer mon compte FREE</Link>
                  </Button>
                ) : (
                  <Button asChild variant={i === 1 ? "default" : "outline"}>
                    <Link href="/app/abonnement">Découvrir {p.name}</Link>
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </section>
        <section className="container cta-section">
          <span className="icon-tile">
            <Sparkles />
          </span>
          <h2>Ton prochain déclic commence ici.</h2>
          <p>Teste tes connaissances et retrouve ton parcours.</p>
          <Button asChild>
            <Link href="/inscription">
              Créer mon compte gratuit <ArrowRight size={18} />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="container footer">
        <Brand />
        <p>© 2026 Revynora · Produit SaaS local</p>
        <div>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/conditions">Conditions</Link>
          <Link href="/design-system">Design system</Link>
          <Link href="/admin">Administration</Link>
        </div>
        <small>
          Mentions légales et confidentialité : à compléter avant toute
          ouverture publique.
        </small>
      </footer>
    </>
  );
}
