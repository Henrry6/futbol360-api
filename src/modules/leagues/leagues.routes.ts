import Leagues from "./leagues.service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import cotroller from "@/modules/leagues/leagues.controller";

export async function leagueRoutes(app: FastifyInstance) {
  // app.addHook("preHandler", authorize("master"));
  app.register(async (app) => {
    // Alcance: master ve todas, admin solo las suyas, sesión de liga solo esa.
    // Sin DELETE: borrar una liga dejaría huérfanos equipos, campeonatos y usuarios.
    app.register(UpRouter, {
      Model: Leagues,
      exclude: ["delOne"],
      controllers: {
        get: cotroller.listLeagues as any,
        getOne: cotroller.getLeague as any,
        putOne: cotroller.updateLeague as any,
      },
    });
    app.get("/dashboard", cotroller.getDashboard);
  });
}
