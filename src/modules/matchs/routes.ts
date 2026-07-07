import Matches from "./service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";

export async function matchesRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Matches });
  });
}
