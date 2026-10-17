import { DomainError } from "../../shared/domain/errors";
export type Slot = { startsAt: Date; endsAt: Date };
export function placeSlot(
  start: Date,
  minutes: number,
  busy: Slot[],
  resolve: boolean,
): Slot {
  if (!Number.isFinite(start.getTime()) || minutes < 15 || minutes > 180)
    throw new DomainError(400, "INVALID_SLOT", "Durée ou date invalide.");
  let slot = { startsAt: start, endsAt: new Date(+start + minutes * 60000) };
  for (const b of [...busy].sort((a, b) => +a.startsAt - +b.startsAt)) {
    if (slot.startsAt < b.endsAt && slot.endsAt > b.startsAt) {
      if (!resolve)
        throw new DomainError(
          409,
          "SCHEDULE_CONFLICT",
          "Ce créneau chevauche une autre séance.",
        );
      slot = {
        startsAt: b.endsAt,
        endsAt: new Date(+b.endsAt + minutes * 60000),
      };
    }
  }
  return slot;
}
export type TaskInput = {
  title: string;
  localStart: string;
  durationMinutes: number;
  reminderMinutes: number | null;
};
export type GenerateInput = {
  title: string;
  timeZone: string;
  resolveConflicts: boolean;
  tasks: TaskInput[];
};
export type PatchInput = {
  version: number;
  localStart?: string;
  durationMinutes?: number;
  status?: "PLANNED" | "DONE" | "CANCELLED";
  title?: string;
  reminderMinutes?: number | null;
  resolveConflicts: boolean;
};
export interface PlanRepository {
  history(user: string, id: string, page: number): Promise<unknown>;
  list(user: string, from: Date, to: Date): Promise<unknown>;
  generate(user: string, input: GenerateInput): Promise<unknown>;
  edit(user: string, id: string, input: PatchInput): Promise<unknown>;
}
