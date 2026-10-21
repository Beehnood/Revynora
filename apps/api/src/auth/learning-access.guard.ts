import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { AuthService, type AuthRequest } from "./auth.service";
import { GetLearningAccess } from "../learning-access/application/learning-access";
import { ApiError } from "../shared/http/errors";
@Injectable()
export class LearningAccessGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(GetLearningAccess) private readonly access: GetLearningAccess,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    req.student = await this.auth.identify(req);
    if (
      req.student.role === "ADMIN" &&
      (req.headers.authorization !== undefined ||
        req.headers["x-revynora-client"] === "mobile")
    )
      throw new ApiError(
        403,
        "STUDENT_REQUIRED",
        "L’accès interne est réservé au Web ; le mobile reste étudiant.",
      );
    if (!(await this.access.execute(req.student.id)).allowed)
      throw new ApiError(
        403,
        "LEARNING_ACCESS_REQUIRED",
        "Aucun droit pédagogique actif pour ce compte.",
      );
    return true;
  }
}
