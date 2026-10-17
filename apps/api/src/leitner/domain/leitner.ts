import { DomainError } from "../../shared/domain/errors";
export const DEFAULT_LEITNER_INTERVALS: readonly number[] = [1, 3, 7, 14, 30];
export function scheduleReview(
  box: number,
  remembered: boolean,
  now: Date,
  intervals: readonly number[] = DEFAULT_LEITNER_INTERVALS,
) {
  if (
    intervals.length !== 5 ||
    intervals.some(
      (days, i) =>
        !Number.isInteger(days) ||
        days < 1 ||
        days > 365 ||
        (i > 0 && days <= intervals[i - 1]!),
    )
  )
    throw new DomainError(
      500,
      "INVALID_LEITNER_CONFIG",
      "Configuration des intervalles Leitner invalide.",
    );
  if (!Number.isInteger(box) || box < 1 || box > 5)
    throw new DomainError(400, "INVALID_BOX", "Boîte invalide.");
  const next = remembered ? Math.min(5, box + 1) : 1;
  return {
    toBox: next,
    nextDueAt: new Date(now.getTime() + intervals[next - 1]! * 86400000),
  };
}
export type CardInput = {
  front: string;
  back: string;
  courseId?: string | null;
};
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
    input: {
      requestId: string;
      version: number;
      remembered: boolean;
      durationSeconds?: number;
    },
  ): Promise<unknown>;
  stats(userId: string): Promise<unknown>;
}
export const CARD_REPOSITORY = Symbol("CardRepository");
