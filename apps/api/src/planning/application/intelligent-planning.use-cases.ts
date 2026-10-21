import { planningAiOutputSchema } from "@revynora/validation";
import type { GetLearningAccess } from "../../learning-access/application/learning-access";
import type { PlanRepository } from "../domain/planning";
import type {
  PlanningContextReader,
  PlanningGenerator,
} from "../domain/intelligent-planning";
import { validateProposalTasks } from "../domain/intelligent-planning";
import { DomainError } from "../../shared/domain/errors";
export class IntelligentPlanning {
  constructor(
    private readonly access: GetLearningAccess,
    private readonly reader: PlanningContextReader,
    private readonly generator: PlanningGenerator,
    private readonly plans: PlanRepository,
    private readonly instant: (local: string, zone: string) => Date,
    private readonly digest: (value: string) => string,
  ) {}
  async propose(userId: string, timeZone: string) {
    await this.access.require(userId, "PRO");
    const context = await this.reader.read(userId, timeZone);
    if (!context.courses.length || !context.slots.length)
      throw new DomainError(
        409,
        "PLANNING_CONTEXT_REQUIRED",
        "Ajoute un cours et une disponibilité future sans conflit.",
      );
    const output = planningAiOutputSchema.safeParse(
      await this.generator.generate(userId, context),
    );
    if (!output.success)
      throw new DomainError(
        503,
        "AI_INVALID_RESPONSE",
        "La proposition reçue est invalide. Aucun planning enregistré.",
      );
    validateProposalTasks(output.data.tasks, context, this.instant);
    return {
      proposal: output.data,
      provider: this.generator.name,
    };
  }
  async confirm(
    userId: string,
    input: { timeZone: string; proposal: unknown; requestId: string },
  ) {
    await this.access.require(userId, "PRO");
    const proposal = planningAiOutputSchema.parse(input.proposal);
    // Persistence rechecks live availability, ownership, exams and collisions under the user lock.
    return this.plans.generate(
      userId,
      {
        title: proposal.title,
        timeZone: input.timeZone,
        resolveConflicts: false,
        tasks: proposal.tasks.map((t) => ({
          ...t,
          kind: "REVISION",
          reminderMinutes: null,
        })),
      },
      {
        requestId: input.requestId,
        hash: this.digest(
          JSON.stringify({ timeZone: input.timeZone, proposal }),
        ),
      },
    );
  }
}
