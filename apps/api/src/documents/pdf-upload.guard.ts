import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import type { Response } from "express";
import type { AuthRequest } from "../auth/auth.service";
import { ApiError } from "../shared/http/errors";
// Reserve before Multer allocates its in-memory buffer, not after extraction.
@Injectable()
export class PdfUploadGuard implements CanActivate {
  private readonly users = new Set<string>();
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const id = request.student.id;
    if (this.users.size >= 2 || this.users.has(id))
      throw new ApiError(
        429,
        "PDF_UPLOAD_BUSY",
        "Un import est déjà en cours. Réessayez dans un instant.",
      );
    this.users.add(id);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      clearTimeout(timer);
      this.users.delete(id);
    };
    const timer = setTimeout(() => {
      request.destroy();
      release();
    }, 30000);
    response.once("finish", release);
    response.once("close", release);
    return true;
  }
}
