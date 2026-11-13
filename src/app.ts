import Debug from "debug";
import Fastify from "fastify";
import jwtPlugin from "./plugins/jwt";
import authPlugin from "./plugins/auth";
import { registerRoutes } from "./routes";
import mailerPlugin from "./plugins/emails";
import uploadPlugin from "./plugins/upload";
import { registerCors } from "./plugins/cors";
import { registerSwagger } from "./plugins/swagger";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: "error",
    },
  });
  Debug.enable("src:*");
  await registerCors(app);
  await registerSwagger(app);
  await app.register(uploadPlugin);
  await app.register(authPlugin);
  await app.register(jwtPlugin);
  await app.register(mailerPlugin);
  app.setErrorHandler((error: any, request, reply) => {
    // Errores de validación de Mongoose (requeridos, únicos, enums…): son
    // errores del dato enviado → 400 con solo los mensajes legibles.
    if (error.name === "ValidationError" && error.errors) {
      error.statusCode = 400;
      error.message = Object.values(error.errors)
        .map((e: any) => e.message)
        .join(" ");
    }
    const statusCode = error.statusCode ?? 500;
    const ignoredRoutes = ["/xxx", "/transactional-annex"];
    const shouldIgnore = ignoredRoutes.some((route) =>
      request.url.includes(route),
    );
    if (!shouldIgnore) {
      console.error(
        [
          "",
          "═══════════════════════════════════════",
          `📅 Fecha: ${new Date().toLocaleString()}`,
          `🌐 Endpoint: ${request.method} ${request.url}`,
          `❌ Error: ${error.name}`,
          `💬 Mensaje: ${error.message}`,
          `📦 Body: ${JSON.stringify(request.body, null, 2)}`,
          `📋 Params: ${JSON.stringify(request.params, null, 2)}`,
          `🔍 Query: ${JSON.stringify(request.query, null, 2)}`,
          `📚 Stack:`,
          error.stack,
          "═══════════════════════════════════════",
        ].join("\n"),
      );
    }

    return reply.status(statusCode).send({
      success: false,
      message: error.message,
      code: error.name,
    });
  });
  await registerRoutes(app);

  app.get("/", async () => {
    return {
      success: true,
      message: "Futbol360 API",
    };
  });

  return app;
}
