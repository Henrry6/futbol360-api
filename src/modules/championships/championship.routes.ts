import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import Champions from "./championship.service";
import cotroller from "@/modules/championships/championship.controller";

export async function championsRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Champions });
    app.get("/:id/generate-fixture", cotroller.generateFixture);
  });
}
