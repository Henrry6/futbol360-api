import Debug from "debug";
import Fastify from "fastify";
import jwtPlugin from "./plugins/jwt";
import authPlugin from "./plugins/auth";
import { registerRoutes } from "./routes";
import { registerCors } from "./plugins/cors";
import { registerSwagger } from "./plugins/swagger";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: "warn",
    },
  });
  Debug.enable("src:*");
  await registerCors(app);
  await registerSwagger(app);
  await app.register(authPlugin);
  await app.register(jwtPlugin);
  await registerRoutes(app);

  app.get("/", async () => {
    return {
      success: true,
      message: "Futbol360 API",
    };
  });

  return app;
}
