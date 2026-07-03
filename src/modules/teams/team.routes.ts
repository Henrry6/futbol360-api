import Teams from "./team.service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import cotroller from "@/modules/teams/team.controller";

export async function teamsRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Teams });
    app.get("/:id/groups", cotroller.getPlayersGroups);
  });
}
