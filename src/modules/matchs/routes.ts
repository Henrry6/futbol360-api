import Matches from "./service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import cotroller from "@/modules/matchs/controller";

export async function matchesRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Matches });
    app.post("/:id/start", cotroller.startMatch);
    app.delete("/:id/revert-start", cotroller.revertStart);
  });
}
