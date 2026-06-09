import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import Teams from "./team.service";

export async function teamsRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Teams });
  });
}
