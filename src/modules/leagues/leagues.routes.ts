import Leagues from "./leagues.service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import cotroller from "@/modules/leagues/leagues.controller";
import { authorize } from "@/plugins/auth";

export async function leagueRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authorize("master"));
  app.register(async (app) => {
    app.register(UpRouter, { Model: Leagues });
    app.get("/dashboard", cotroller.getDashboard);
  });
}
