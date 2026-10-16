import { completeOpenApi } from "./openapi";
import type { INestApplication } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { loadEnvironment } from "../config/environment";
import { ApiExceptionFilter } from "./errors";
export function configureApp(app: INestApplication) {
  const env = loadEnvironment();
  const origins = new Set([env.WEB_ORIGIN]);
  if (new URL(env.WEB_ORIGIN).hostname === "localhost")
    origins.add(env.WEB_ORIGIN.replace("localhost", "127.0.0.1"));
  if (new URL(env.WEB_ORIGIN).hostname === "127.0.0.1")
    origins.add(env.WEB_ORIGIN.replace("127.0.0.1", "localhost"));
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: [...origins],
    credentials: true,
    methods: ["GET", "POST", "PUT"],
    allowedHeaders: ["Content-Type", "X-Revynora-Client"],
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.headers["x-revynora-client"] !== "web" ||
        (req.headers.origin && !origins.has(req.headers.origin)))
    ) {
      res.status(403).json({
        code: "CSRF_REJECTED",
        message: "Origine de la requête refusée.",
        requestId: crypto.randomUUID(),
      });
      return;
    }
    next();
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  const config = new DocumentBuilder()
    .setTitle("Revynora · MVP pédagogique")
    .setDescription(
      "API Phase 1. Sessions HttpOnly ; POST/PUT requièrent X-Revynora-Client: web. Aucune solution avant soumission. Les erreurs ont la forme {code,message,details?,requestId}.",
    )
    .setVersion("1.0.0")
    .addCookieAuth("revynora_session")
    .build();
  const document = completeOpenApi(SwaggerModule.createDocument(app, config));
  SwaggerModule.setup("api/v1/docs", app, document, {
    jsonDocumentUrl: "/api/v1/openapi.json",
  });
  return app;
}
