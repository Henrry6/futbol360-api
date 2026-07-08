import { FastifyError } from "@/libs/utils";
import MatchModel from "@/modules/matchs/service";
import { FastifyReply, FastifyRequest } from "fastify";

export default {
  startMatch: async (
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
    await match.start(req.payload.user);
    reply.send({
      success: true,
      data: match,
    });
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
