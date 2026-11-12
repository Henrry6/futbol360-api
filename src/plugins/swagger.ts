import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import { FastifyInstance } from "fastify";

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: { title: "Futbol360 API", version: "1.0.0" },
      // Botón "Authorize" en /docs: pegar el token de POST /auth/login
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      // Conserva el token al recargar /docs
      persistAuthorization: true,
    },
  });
}
