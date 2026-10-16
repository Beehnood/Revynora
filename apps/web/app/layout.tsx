import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Revynora — Apprends mieux. Mémorise durablement.",
    template: "%s | Revynora",
  },
  description:
    "Revynora : diagnostics, cours personnalisés, révisions Leitner et planning pour apprendre et mémoriser durablement.",
  icons: { icon: "/brand/logo-mark.svg", apple: "/brand/app-icon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
