import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Revynora — Apprends mieux. Mémorise durablement.",
    template: "%s | Revynora",
  },
  description:
    "Découvrez le futur copilote éducatif Revynora : tester, apprendre, mémoriser et organiser ses études.",
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
