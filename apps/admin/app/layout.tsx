import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Administration · Revynora",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/logo-mark.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <a className="skip-link" href="#main">
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
