import { completeOpenApi } from "./openapi";
import type { INestApplication } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { loadEnvironment } from "../config/environment";
import { ApiExceptionFilter } from "./errors";
export function configureApp(app: INestApplication) {
  const env = loadEnvironment();
  const origins = new Set([env.WEB_ORIGIN, env.ADMIN_ORIGIN]);
  for (const origin of [env.WEB_ORIGIN, env.ADMIN_ORIGIN]) {
    if (new URL(origin).hostname === "localhost")
      origins.add(origin.replace("localhost", "127.0.0.1"));
    if (new URL(origin).hostname === "127.0.0.1")
      origins.add(origin.replace("127.0.0.1", "localhost"));
  }
  app.getHttpAdapter().getInstance().set("trust proxy", env.TRUST_PROXY_HOPS);
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: [...origins],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Revynora-Client", "Authorization"],
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const native =
      req.headers["x-revynora-client"] === "mobile" &&
      !req.headers.origin &&
      (req.path === "/api/v1/auth/mobile/login" ||
        req.path === "/api/v1/auth/mobile/register" ||
        /^Bearer [a-zA-Z0-9_-]{43}$/.test(req.headers.authorization ?? ""));
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !(req.method === "POST" && req.path === "/api/v1/webhooks/stripe") &&
      !native &&
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
    .setTitle("Revynora · API Web et Mobile")
    .setDescription(
      "API Web/Mobile. Web : sessions HttpOnly et X-Revynora-Client: web. Mobile : bearer opaque et X-Revynora-Client: mobile, sans Origin ni cookie. Les endpoints /auth/mobile/login et register renvoient une session native. Aucun corrigé avant soumission. Erreurs {code,message,details?,requestId}.",
    )
    .setVersion("4.0.0")
    .addCookieAuth("revynora_session")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "opaque" })
    .build();
  const document = completeOpenApi(SwaggerModule.createDocument(app, config));
  SwaggerModule.setup("api/v1/docs", app, document, {
    jsonDocumentUrl: "/api/v1/openapi.json",
  });
  return app;
}
