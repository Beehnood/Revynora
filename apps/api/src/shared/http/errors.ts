import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { Prisma } from "@prisma/client";
export class ApiError extends HttpException {
  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super({ code, message, ...(details ? { details } : {}) }, status);
  }
}
export function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(
      400,
      "VALIDATION",
      "Vérifiez les champs du formulaire.",
      result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    );
  return result.data;
}
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const requestId = String(
      request.headers["x-request-id"] ?? randomUUID(),
    ).slice(0, 64);
    let status = 500;
    let body: { code: string; message: string; details?: unknown } = {
      code: "INTERNAL",
      message: "Le service est temporairement indisponible.",
    };
    if (error instanceof ApiError) {
      status = error.getStatus();
      body = error.getResponse() as typeof body;
    } else if (error instanceof ZodError) {
      status = 400;
      body = { code: "VALIDATION", message: "Données invalides." };
    } else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      status = 409;
      body = {
        code: "CONFLICT",
        message:
          "Cette opération ne peut pas être effectuée avec ces informations.",
      };
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      body = {
        code: status === 404 ? "NOT_FOUND" : "HTTP_ERROR",
        message:
          status === 404
            ? "Ressource introuvable."
            : "La requête ne peut pas être traitée.",
      };
    }
    response.status(status).setHeader("X-Request-Id", requestId);
    response.json({ ...body, requestId });
  }
}
