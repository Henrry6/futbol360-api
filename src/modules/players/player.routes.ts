import Players from "./player.service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";

export async function playersRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Players });
  });
}
