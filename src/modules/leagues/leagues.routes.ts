import Leagues from "./leagues.service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";

export async function leagueRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Leagues });
  });
}
