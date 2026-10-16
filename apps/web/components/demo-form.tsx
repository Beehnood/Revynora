"use client";
import { useState } from "react";
import { demoFormSchema } from "@revynora/validation";
import { Alert, FormField, Input, Select, Textarea } from "./ui";
import { Button } from "./ui/button";
export function DemoForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");
  return (
    <form
      className="form-grid"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const parsed = demoFormSchema.safeParse(Object.fromEntries(data));
        if (!parsed.success) {
          setErrors(
            Object.fromEntries(
              parsed.error.issues.map((i) => [i.path[0], i.message]),
            ),
          );
          setState("idle");
          return;
        }
        setErrors({});
        setState("loading");
        await new Promise((resolve) => setTimeout(resolve, 400));
        setState("success");
      }}
    >
      <p>Démonstration locale : aucune donnée envoyée ni enregistrée.</p>
      <FormField id="name" label="Prénom" error={errors.name}>
        <Input
          id="name"
          name="name"
          autoComplete="given-name"
          required
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
      </FormField>
      <FormField id="subject" label="Matière" error={errors.subject}>
        <Select
          id="subject"
          name="subject"
          aria-invalid={!!errors.subject}
          aria-describedby={errors.subject ? "subject-error" : undefined}
        >
          <option value="maths">Mathématiques</option>
          <option value="physics">Physique</option>
          <option value="languages">Langues</option>
        </Select>
      </FormField>
      <FormField
        id="message"
        label="Objectif d’apprentissage"
        error={errors.message}
      >
        <Textarea
          id="message"
          name="message"
          required
          rows={3}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
        />
      </FormField>
      <Button disabled={state === "loading"} aria-busy={state === "loading"}>
        {state === "loading" ? "Vérification…" : "Tester le formulaire"}
      </Button>
      {state === "success" && (
        <Alert>
          Formulaire valide. Démonstration terminée, sans envoi de données.
        </Alert>
      )}
    </form>
  );
}
