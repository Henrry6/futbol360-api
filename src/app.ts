import Fastify from "fastify";
import jwtPlugin from "./plugins/jwt";
import authPlugin from "./plugins/auth";
import { registerRoutes } from "./routes";
import { registerCors } from "./plugins/cors";
import { registerSwagger } from "./plugins/swagger";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await registerCors(app);
  await registerSwagger(app);
  await app.register(authPlugin);
  await app.register(jwtPlugin);
  await registerRoutes(app);

  app.get("/health", async () => {
    return {
      success: true,
      message: "Futbol360 API",
    };
  });

  return app;
}
