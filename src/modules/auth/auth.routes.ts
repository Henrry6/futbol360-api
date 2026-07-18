import { FastifyInstance } from "fastify";
import { authUser } from "./auth.controller";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", {
    handler: authUser.postLogin,
    schema: {
      body: {
        type: "object",
        properties: {
          code: { type: "string" },
          username: { type: "string" },
          password: { type: "string" },
        },
        required: ["username", "password"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                roles: { type: "array" },
                league: { type: "string" },
                nameLiga: { type: "string" },
                code: { type: "string" },
              },
              required: ["id", "name", "roles", "league", "nameLiga", "code"],
            },
          },
        },
      },
    },
  });

  app.post("/admin/login", {
    handler: authUser.postAdmin,
    schema: {
      body: {
        type: "object",
        properties: {
          username: { type: "string" },
          password: { type: "string" },
        },
        required: ["username", "password"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                roles: { type: "array" },
              },
              required: ["id", "name", "roles"],
            },
          },
        },
      },
    },
  });
}
