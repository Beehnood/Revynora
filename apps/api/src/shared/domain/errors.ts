export class DomainError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
export const missing = () =>
  new DomainError(404, "NOT_FOUND", "Ressource introuvable.");
