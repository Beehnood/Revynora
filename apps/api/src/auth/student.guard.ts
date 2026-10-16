import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { AuthService, type AuthRequest } from "./auth.service";
import { ApiError } from "../shared/http/errors";
@Injectable()
export class StudentGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    req.student = await this.auth.identify(req);
    if (req.student.role !== "STUDENT" || req.student.plan !== "FREE")
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Cet espace est réservé aux comptes étudiants FREE.",
      );
    return true;
  }
}
