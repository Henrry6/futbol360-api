import Matches from "./service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import cotroller from "@/modules/matchs/controller";
import { authorize } from "@/plugins/auth";

export async function matchesRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Matches });
    app.post("/:id/start", cotroller.startMatch);
    app.delete("/:id/revert-start", cotroller.revertStart);
    // Corrección administrativa de penales (partidos knockout ya cerrados)
    app.put("/:id/penalties", {
      preHandler: authorize(["admin", "directivo"]),
      handler: cotroller.updatePenalties,
      schema: {
        description:
          "Registra o corrige los penales de un partido de eliminación directa terminado en empate.",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            localPenalties: { type: "integer", minimum: 0 },
            visitorPenalties: { type: "integer", minimum: 0 },
          },
          required: ["localPenalties", "visitorPenalties"],
        },
      },
    });
  });
}
