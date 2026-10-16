import { DomainError } from "../../shared/domain/errors";
export function scheduleReview(box: number, remembered: boolean, now: Date) {
  if (!Number.isInteger(box) || box < 1 || box > 5)
    throw new DomainError(400, "INVALID_BOX", "Boîte invalide.");
  const next = remembered ? Math.min(5, box + 1) : 1;
  return {
    toBox: next,
    nextDueAt: new Date(now.getTime() + [1, 2, 4, 7, 14][next - 1]! * 86400000),
  };
}
export type CardInput = { front: string; back: string; courseId?: string };
export interface CardRepository {
  list(
    userId: string,
    due: boolean,
    page: number,
    pageSize: number,
  ): Promise<unknown>;
  create(userId: string, input: CardInput): Promise<unknown>;
  edit(
    userId: string,
    id: string,
    version: number,
    input: CardInput,
  ): Promise<unknown>;
  archive(userId: string, id: string): Promise<unknown>;
  review(
    userId: string,
    id: string,
    input: { requestId: string; version: number; remembered: boolean },
  ): Promise<unknown>;
  stats(userId: string): Promise<unknown>;
}
export const CARD_REPOSITORY = Symbol("CardRepository");
