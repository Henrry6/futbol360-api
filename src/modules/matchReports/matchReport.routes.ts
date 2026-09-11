import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import MatchReport from "./matchReport.service";
import cotroller from "@/modules/matchReports/controller";

export async function matchReportRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: MatchReport, exclude: ["putOne"] });
    app.post("/:id/finalizar", cotroller.endReportMatch);
    app.put("/:id", cotroller.actualizarVocalia);
  });
}
