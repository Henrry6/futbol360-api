import Players from "./player.service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import controller from "@/modules/players/player.controller";

export async function playersRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Players });

    app.post("/:id/image", controller.uploadImage);
    app.get("/:id/image", controller.getImage);
    app.delete("/:id/image", controller.deleteImage);
  });
}
