import { it, expect, vi } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { LearningAccessGuard } from "./learning-access.guard";
import type { AuthService } from "./auth.service";
import type { GetLearningAccess } from "../learning-access/application/learning-access";
it("identifie la session avant les droits et ne change jamais le rôle ADMIN", async () => {
  const req = { headers: {} } as {
    student?: { role: string };
    headers: Record<string, string>;
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as ExecutionContext;
  const identify = vi.fn().mockResolvedValue({ id: "u", role: "ADMIN" });
  const execute = vi.fn().mockResolvedValue({ allowed: true });
  const guard = new LearningAccessGuard(
    { identify } as unknown as AuthService,
    { execute } as unknown as GetLearningAccess,
  );
  await expect(guard.canActivate(context)).resolves.toBe(true);
  expect(req.student?.role).toBe("ADMIN");
  req.headers.authorization = "Bearer opaque";
  await expect(guard.canActivate(context)).rejects.toThrow("réservé au Web");
  delete req.headers.authorization;
  execute.mockResolvedValue({ allowed: false });
  await expect(guard.canActivate(context)).rejects.toThrow();
  identify.mockRejectedValue(new Error("Session expirée ou compte désactivé"));
  execute.mockClear();
  await expect(guard.canActivate(context)).rejects.toThrow("Session expirée");
  expect(execute).not.toHaveBeenCalled();
});
