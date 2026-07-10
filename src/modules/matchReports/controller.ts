import { FastifyError } from "@/libs/utils";
import MatchModel from "@/modules/matchs/service";
import { FastifyReply, FastifyRequest } from "fastify";
import Vocalias from "./matchReport.service";

export default {
  endReportMatch: async (
    req: FastifyRequest<{
      Params: {
        id: string;
      };
      Body: {
        status: "finalizado" | "suspendido";
      };
    }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    const vocalia = await Vocalias.findById(id);
    if (!vocalia) {
      throw new FastifyError("Vocalia no encontradoA");
    }
    if (!req.body.status) {
      throw new FastifyError("Indique el estado de la vocalía.");
    }
    await vocalia.finish(req.body.status, req.payload.user);
    reply.send("Vocalia finalizada");
  },
  revertStart: async (
    req: FastifyRequest<{
      Params: {
        id: string;
      };
    }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    const match = await MatchModel.findById(id);
    if (!match) {
      throw new FastifyError("Partido no encontrado");
    }
    await match.revertStart();
    reply.send({
      success: true,
      data: match,
    });
  },
};
