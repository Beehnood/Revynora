import { DomainError } from "../../shared/domain/errors";
export type PlanningContext = {
  now: string;
  timeZone: string;
  courses: {
    id: string;
    title: string;
    subject: string;
    averageScore: number | null;
    weak: string[];
    due: string[];
    exam: string | null;
  }[];
  slots: { localStart: string; startsAt: string; endsAt: string }[];
};
export interface PlanningContextReader {
  read(userId: string, timeZone: string): Promise<PlanningContext>;
}
export interface PlanningGenerator {
  readonly name: "mock" | "openai";
  generate(userId: string, context: PlanningContext): Promise<unknown>;
}
export function validateProposalTasks(
  tasks: { courseId: string; localStart: string; durationMinutes: number }[],
  context: PlanningContext,
  instant: (local: string, zone: string) => Date,
) {
  const busy: { start: number; end: number }[] = [];
  for (const task of tasks) {
    const course = context.courses.find((c) => c.id === task.courseId);
    const start = +instant(task.localStart, context.timeZone),
      end = start + task.durationMinutes * 60000;
    if (
      !course ||
      start < +new Date(context.now) ||
      !context.slots.some(
        (s) => start >= +new Date(s.startsAt) && end <= +new Date(s.endsAt),
      ) ||
      (course.exam && end > +new Date(course.exam)) ||
      busy.some((b) => start < b.end && end > b.start)
    )
      throw new DomainError(
        409,
        "INVALID_PROPOSAL",
        "La proposition ne respecte pas les cours, examens ou disponibilités. Regénérez-la.",
      );
    busy.push({ start, end });
  }
}
