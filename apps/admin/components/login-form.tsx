"use client";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { api, message } from "@/lib/api";
import { Brand } from "@revynora/ui/brand";
import { Card, Alert, Input, FormField } from "@revynora/ui";
import { Button } from "@revynora/ui/button";
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function LoginForm() {
  const router = useRouter();
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main id="main" className="container section">
      <Brand />
      <Card>
        <h1>Connexion administrateur</h1>
        <p>Utilisez votre compte administrateur existant.</p>
        <form
          method="post"
          className="saas-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            const values = Object.fromEntries(new FormData(e.currentTarget));
            try {
              const user = await api<{ role: string }>("/auth/login", {
                method: "POST",
                body: JSON.stringify(values),
              });
              if (user.role !== "ADMIN") {
                setError("Ce compte ne dispose pas des droits administrateur.");
                setBusy(false);
                return;
              }
              router.replace("/");
              router.refresh();
            } catch (e) {
              setError(message(e));
              setBusy(false);
            }
          }}
        >
          <FormField id="email" label="Adresse e-mail">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
            />
          </FormField>
          <FormField id="password" label="Mot de passe">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={12}
            />
          </FormField>
          {error && <Alert role="alert">{error}</Alert>}
          <Button disabled={busy || !ready}>
            {busy ? "Connexion…" : "Me connecter"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
