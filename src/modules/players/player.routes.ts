import Players from "./player.service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import { imageController } from "@/libs/imageController";
const controllerImage = imageController(Players, "photo", "futbol360/players");

export async function playersRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Players });
    app.post("/:id/image", controllerImage.uploadImage);
    app.get("/:id/image", controllerImage.getImage);
    app.delete("/:id/image", controllerImage.deleteImage);
  });
}
