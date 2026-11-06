import Teams from "./team.service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import cotroller from "@/modules/teams/team.controller";

export async function teamsRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Teams });
    app.get("/:id/groups", cotroller.getPlayersGroups);
    // Cargar imagen
    app.post("/:id/image", cotroller.uploadImage);
    app.get("/:id/image", cotroller.getImage);
    app.delete("/:id/image", cotroller.deleteImage);
  });
}
