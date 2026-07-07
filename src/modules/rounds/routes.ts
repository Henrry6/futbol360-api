import Rounds from "./service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";

export async function roundsRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Rounds });
  });
}
