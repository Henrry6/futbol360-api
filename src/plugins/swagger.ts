import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import { FastifyInstance } from "fastify";

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger);

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });
}
