import { FastifyError } from "@/libs/utils";
import { FastifyReply, FastifyRequest } from "fastify";
import Jugadores from "@/modules/players/player.service";

export default {
  test: async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    const player = await Jugadores.findOne({
      _id: id,
      league: req.payload.league,
    });
    if (!player) {
      throw new FastifyError("No se encontró el jugador");
    }

    reply.send({ success: true });
  },
};
