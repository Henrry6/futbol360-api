import Debug from "debug";
import Vocalias from "./matchReport.service";
import Rounds from "@/modules/rounds/service";
import Partidos from "@/modules/matchs/service";
import Campeonato from "@/modules/championships/championship.service";
import { FastifyReply, FastifyRequest } from "fastify";
import { deepmerge, FastifyError, getMovimiento } from "@/libs/utils";

const debug = Debug("src:modules:matchsReports:controller");

export const actualizarVocalia = async (
  request: FastifyRequest<{
    Params: { id: string };
    Body: Record<string, any>;
  }>,
  reply: FastifyReply,
) => {
  const { id } = request.params;

  const vocalia = await Vocalias.findById(id);
  if (!vocalia) {
    throw new FastifyError("No se encontró la vocalía a editar", 404);
  }

  vocalia.$locals.docOriginal = vocalia.toObject();

  const original = vocalia.toObject() as Record<string, any>;
  const cambios = request.body as Record<string, any>;

  vocalia.set((deepmerge as any)(original, cambios));
  if (vocalia.isModified()) {
    await vocalia.save();
  }

  return reply.send(vocalia);
};
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
    const { status } = req.body;
    const vocalia = await Vocalias.findById(id);
    if (!vocalia) {
      throw new FastifyError("Vocalia no encontradoA");
    }
    if (!req.body.status) {
      throw new FastifyError("Indique el estado de la vocalía.");
    }
    if (vocalia.status === "finalizada") {
      throw new FastifyError("La vocalía ya fue finalizada.");
    }
    if (!vocalia.endTime) {
      vocalia.endTime = new Date();
    }
    vocalia.status = "finalizada";
    const movimiento = await getMovimiento({
      user: req.payload.user,
      type: status,
    });
    vocalia._movements.push(movimiento);
    await vocalia.save();

    await Partidos.updateOne(
      { _id: vocalia.match },
      {
        $set: { status },
        $push: { _movements: movimiento },
      },
    );
    const partidosPendientes = await Partidos.countDocuments({
      round: vocalia.round,
      status: { $nin: ["finalizado", "suspendido"] },
    });

    if (partidosPendientes === 0) {
      debug("Finalizando la jornada");
      await Rounds.findByIdAndUpdate(vocalia.round, {
        status: "finalizado",
      });

      // Verificar si con esto también se completó la etapa
      const rondasPendientes = await Rounds.countDocuments({
        stage: vocalia.stage,
        status: { $ne: "finalizado" },
      });

      if (rondasPendientes === 0) {
        debug("Finalizando la etapa");
        await Campeonato.updateOne(
          { _id: vocalia.championship, "stages._id": vocalia.stage },
          { $set: { "stages.$.status": "finalizada" } },
        );
      }
    }
    reply.send("Vocalia finalizada");
  },
  actualizarVocalia,
};
