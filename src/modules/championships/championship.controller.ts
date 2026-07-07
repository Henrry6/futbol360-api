import mongoose from "mongoose";
import Debug from "debug";
import { FastifyError } from "@/libs/utils";
import Fixture from "@/modules/fixtures/service";
import Partidos from "@/modules/matchs/service";
import Campeonato from "@/modules/championships/championship.service";
import { FastifyReply, FastifyRequest } from "fastify";
import { getCompetition } from "./competicion";

const debug = Debug("src:modules:championships:championship.controller");

function shuffle<T>(array: T[]) {
  const arr = [...array];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

export default {
  generateFixture: async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      debug("Generar fixture", id);
      const campeonato = await Campeonato.findOne({
        _id: id,
        league: req.payload.league,
      });
      if (!campeonato) {
        throw new FastifyError("No se encontró el campeonato");
      }
      await campeonato.generateFixture();
      reply.send({
        message: "Fixture generado correctamente",
      });
    } catch (error) {
      throw error;
    }
  },
};
