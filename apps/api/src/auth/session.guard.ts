import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { AuthService, type AuthRequest } from "./auth.service";
import { ApiError } from "../shared/http/errors";
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(c: ExecutionContext) {
    const req = c.switchToHttp().getRequest<AuthRequest>();
    req.student = await this.auth.identify(req);
    return true;
  }
}
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(c: ExecutionContext) {
    const req = c.switchToHttp().getRequest<AuthRequest>();
    req.student = await this.auth.identify(req);
    if (req.student.role !== "ADMIN")
      throw new ApiError(403, "ADMIN_REQUIRED", "Accès administrateur requis.");
    return true;
  }
}
