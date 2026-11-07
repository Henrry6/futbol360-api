import Teams from "./team.service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import cotroller from "@/modules/teams/team.controller";
import { imageController } from "@/libs/imageController";
const controllerImage = imageController(Teams, "logo", "futbol360/teams");

export async function teamsRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Teams });
    app.get("/:id/groups", cotroller.getPlayersGroups);
    // Cargar imagen
    app.post("/:id/image", controllerImage.uploadImage);
    app.get("/:id/image", controllerImage.getImage);
    app.delete("/:id/image", controllerImage.deleteImage);
  });
}
