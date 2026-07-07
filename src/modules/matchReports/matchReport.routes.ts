import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import MatchReport from "./matchReport.service";

export async function matchReportRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: MatchReport });
  });
}
