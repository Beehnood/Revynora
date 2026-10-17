import type {
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "./utils";
export function Card(p: HTMLAttributes<HTMLElement>) {
  return <section {...p} className={cn("card", p.className)} />;
}
export function Badge(p: HTMLAttributes<HTMLSpanElement>) {
  return <span {...p} className={cn("badge", p.className)} />;
}
export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cn("input", p.className)} />;
}
export function Label(p: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...p} />;
}
export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cn("input", p.className)} />;
}
export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cn("input", p.className)} />;
}
export function Separator() {
  return <hr className="separator" />;
}
export function Skeleton() {
  return (
    <div className="skeleton" aria-label="Chargement en cours" role="status" />
  );
}
export function Alert(p: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...p}
      role={p.role ?? "status"}
      className={cn("alert", p.className)}
    />
  );
}
export function PageContainer(p: HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn("page-container", p.className)} />;
}
export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="page-heading">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-symbol" aria-hidden="true">
        ✧
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function ErrorState() {
  return (
    <Alert role="alert">
      Le chargement a échoué. Réessayez ultérieurement.
    </Alert>
  );
}
export function LoadingState() {
  return (
    <div aria-busy="true">
      <Skeleton />
      <span className="sr-only">Chargement en cours</span>
    </div>
  );
}
export function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-field">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
