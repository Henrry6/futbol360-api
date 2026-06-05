import Users from "./users.service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";

export async function userRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Users });
  });
}
