"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Brand } from "./brand";
import { Menu, X, ArrowUpRight } from "./icons";
import { Button } from "./ui/button";
export function PublicNav() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  function close() {
    setOpen(false);
    toggle.current?.focus();
  }
  return (
    <header className="public-header">
      <div className="container nav-inner">
        <Brand />
        <button
          ref={toggle}
          className="menu-toggle"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          aria-controls="public-menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav
          id="public-menu"
          className={open ? "public-nav open" : "public-nav"}
          aria-label="Navigation principale"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <Link href="/#methode" onClick={() => setOpen(false)}>
            La méthode
          </Link>
          <Link href="/#matieres" onClick={() => setOpen(false)}>
            Les matières
          </Link>
          <Link href="/#tarifs" onClick={() => setOpen(false)}>
            Les offres
          </Link>
          <Link href="/connexion">Connexion</Link>
          <Button asChild>
            <Link href="/inscription">
              Créer mon compte <ArrowUpRight size={16} />
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
