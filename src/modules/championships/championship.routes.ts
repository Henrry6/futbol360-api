import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import Champions from "./champioship.service";

export async function championsRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Champions });
  });
}
