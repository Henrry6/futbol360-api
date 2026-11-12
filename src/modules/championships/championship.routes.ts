import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import Champions from "./championship.service";
import cotroller from "@/modules/championships/championship.controller";

export async function championsRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Champions });
    app.post("/:id/generate-fixture/:stageId", cotroller.generateFixture);
    app.delete("/:id/delete-fixture/:stageId", cotroller.deleteFixture);
    app.get("/:id/table-positions", cotroller.tablePositions);
    // Rutas stages
    app.post("/:id/stages", cotroller.createStage);
    app.get("/:id/stages", cotroller.getStages);
    app.put("/:id/stages/:stageId", cotroller.updateStage);
    app.delete("/:id/stages/:stageId", cotroller.deleteStage);
    app.post("/:id/stages/:stageId/advance", cotroller.advanceStage);
  });
}
