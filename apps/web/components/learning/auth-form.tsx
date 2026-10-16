"use client";
import { useState } from "react";
import Link from "next/link";
import { registerSchema, loginSchema } from "@revynora/validation";
import { Eye, EyeOff, ArrowRight, CheckCircle2, BookOpen } from "lucide-react";
import { Brand } from "../brand";
import { Alert, FormField, Input } from "../ui";
import { Button } from "../ui/button";
import { api, message, RequestError, safeReturn } from "@/lib/api";
export function AuthForm({ register = false }: { register?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  return (
    <main id="main" className="auth-page">
      <div className="auth-intro">
        <Brand />
        <div>
          <span className="eyebrow">TON APPRENTISSAGE COMMENCE ICI</span>
          <p className="auth-slogan">
            {register
              ? "Chaque déclic mérite un début."
              : "Heureux de te retrouver."}
          </p>
          <p>
            Teste ce que tu sais. Comprends ce qui te manque. Avance à ton
            rythme.
          </p>
          <div className="auth-promise">
            <CheckCircle2 /> Un compte gratuit, un espace à toi.
          </div>
          <div className="auth-promise">
            <CheckCircle2 /> Tes résultats et tes cours restent privés.
          </div>
        </div>
        <Link href="/">← Retour à l’accueil</Link>
      </div>
      <section className="auth-panel">
        <span className="icon-tile purple">
          <BookOpen />
        </span>
        <h1>{register ? "Créer mon compte FREE" : "Me connecter"}</h1>
        <p>
          {register
            ? "Pas de carte bancaire. Juste ta curiosité."
            : "Reprends ton parcours là où tu l’as laissé."}
        </p>
        <form
          noValidate
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setError("");
            const values = Object.fromEntries(new FormData(e.currentTarget));
            const parsed = (register ? registerSchema : loginSchema).safeParse(
              values,
            );
            if (!parsed.success) {
              setErrors(
                Object.fromEntries(
                  parsed.error.issues.map((i) => [i.path[0], i.message]),
                ),
              );
              return;
            }
            setErrors({});
            setBusy(true);
            try {
              await api("/auth/" + (register ? "register" : "login"), {
                method: "POST",
                body: JSON.stringify(parsed.data),
              });
              setSuccess(true);
              window.location.assign(
                safeReturn(
                  new URLSearchParams(window.location.search).get("retour"),
                ),
              );
            } catch (e) {
              setError(message(e));
              if (e instanceof RequestError)
                setErrors(
                  Object.fromEntries(
                    e.details.map((d) => [d.field, d.message]),
                  ),
                );
              setBusy(false);
            }
          }}
        >
          {register && (
            <FormField id="name" label="Prénom" error={errors.name}>
              <Input
                id="name"
                name="name"
                autoComplete="given-name"
                required
                maxLength={80}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
            </FormField>
          )}
          <FormField id="email" label="Adresse e-mail" error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
          </FormField>
          <FormField id="password" label="Mot de passe" error={errors.password}>
            <div className="password-input">
              <Input
                id="password"
                name="password"
                type={visible ? "text" : "password"}
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={12}
                maxLength={128}
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "password-error" : "password-help"
                }
              />
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                aria-label={
                  visible
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
                aria-pressed={visible}
              >
                {visible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            <small id="password-help">
              12 caractères minimum. Utilise un mot de passe unique.
            </small>
          </FormField>
          {error && <Alert role="alert">{error}</Alert>}
          {success && (
            <Alert>Connexion réussie. Ouverture de ton espace…</Alert>
          )}
          <Button disabled={busy} aria-busy={busy}>
            {busy
              ? "Ouverture de ton espace…"
              : register
                ? "Créer mon compte gratuit"
                : "Me connecter"}{" "}
            <ArrowRight size={17} />
          </Button>
        </form>
        <p className="auth-switch">
          {register ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
          <Link href={register ? "/connexion" : "/inscription"}>
            {register ? "Se connecter" : "Créer un compte gratuit"}
          </Link>
        </p>
        <small className="privacy-note">
          Prototype local · Aucun paiement. N’indique pas d’informations
          sensibles dans tes diagnostics.
        </small>
      </section>
    </main>
  );
}
