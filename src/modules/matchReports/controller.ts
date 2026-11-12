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

  const vocalia = await Vocalias.findOne({
    _id: id,
    league: request.payload.league,
  });
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
  /**
   * Cierra la vocalía y el partido (finalizado o suspendido).
   * En eliminación directa, si el partido terminó empatado, deben enviarse
   * `localPenalties` y `visitorPenalties` (distintos) para definir al ganador.
   * Si con esto termina la jornada, el campeonato avanza solo: crea la
   * siguiente ronda (knockout), finaliza la etapa y/o el campeonato.
   */
  endReportMatch: async (
    req: FastifyRequest<{
      Params: {
        id: string;
      };
      Body: {
        status: "finalizado" | "suspendido";
        localPenalties?: number;
        visitorPenalties?: number;
      };
    }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    const { status, localPenalties, visitorPenalties } = req.body ?? {};
    const vocalia = await Vocalias.findOne({
      _id: id,
      league: req.payload.league,
    });
    if (!vocalia) {
      throw new FastifyError("Vocalia no encontrada");
    }
    if (!["finalizado", "suspendido"].includes(status)) {
      throw new FastifyError("Indique el estado de la vocalía.");
    }
    if (vocalia.status === "finalizada") {
      throw new FastifyError("La vocalía ya fue finalizada.");
    }

    const [partido, campeonato] = await Promise.all([
      Partidos.findById(vocalia.match),
      Campeonato.findById(vocalia.championship),
    ]);
    if (!partido || !campeonato) {
      throw new FastifyError("No se encontró el partido de la vocalía", 404);
    }

    // Eliminación directa: un empate se define por penales
    const stage = campeonato.stages.id(vocalia.stage);
    const matchUpdate: Record<string, unknown> = { status };
    if (stage?.mode === "knockout") {
      const hasPenalties =
        typeof localPenalties === "number" &&
        typeof visitorPenalties === "number";
      if (hasPenalties) {
        matchUpdate.localPenalties = localPenalties;
        matchUpdate.visitorPenalties = visitorPenalties;
      }
      const tie = (partido.localGoals ?? 0) === (partido.visitorGoals ?? 0);
      if (tie && (!hasPenalties || localPenalties === visitorPenalties)) {
        throw new FastifyError(
          "El partido terminó empatado: en eliminación directa registre los penales (localPenalties y visitorPenalties) con un ganador.",
        );
      }
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
        $set: matchUpdate,
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
      // Siguiente ronda (knockout), fin de etapa y fin de campeonato
      await campeonato.afterRoundFinished(vocalia.round);
    }
    reply.send("Vocalia finalizada");
  },
  actualizarVocalia,
};
