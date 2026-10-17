import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadEnvironment } from "./shared/config/environment";
import { configureApp } from "./shared/http/configure";
async function bootstrap() {
  const env = loadEnvironment();
  const app = configureApp(
    await NestFactory.create(AppModule, { rawBody: true }),
  );
  await app.listen(env.PORT, env.HOST);
}
bootstrap().catch(() => {
  console.error("Démarrage API impossible : vérifiez la configuration.");
  process.exitCode = 1;
});
