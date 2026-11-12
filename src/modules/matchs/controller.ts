import Debug from "debug";
import { Types } from "mongoose";
import Rounds from "@/modules/rounds/service";
import Partidos from "@/modules/matchs/service";
import { MatchDocument } from "@/models/matchs/match";
import { FastifyReply, FastifyRequest } from "fastify";
import { FastifyError, getMovimiento } from "@/libs/utils";
import matchEventService from "../matchEvents/matchEvent.service";
import Campeonatos from "@/modules/championships/championship.service";
import MatchReport from "@/modules/matchReports/matchReport.service";
const debug = Debug("src:modules:matchs:controller");

async function createReport(match: MatchDocument, userId: Types.ObjectId) {
  debug("Creando vocalia para el partido:", match._id);
  const creador = await getMovimiento({
    type: "created",
    user: userId,
  });
  return MatchReport.create({
    league: match.league,
    championship: match.championship,
    stage: match.stage,
    round: match.round,
    match: match._id,
    status: "en_juego",
    startTime: new Date(),
    vocal: match.vocal,
    local: {
      team: match.localTeam,
      captainArmband: false,
      dressingRoomClean: false,
      dressingRoomEquipment: false,
    },
    visitor: {
      team: match.visitorTeam,
      captainArmband: false,
      dressingRoomClean: false,
      dressingRoomEquipment: false,
    },
    assistantReferees: [],
    _movements: [creador],
  });
}

async function validateCurrentRound(match: MatchDocument) {
  // Buscar primero una jornada en juego.
  let currentRound = await Rounds.findOne({
    stage: match.stage,
    status: "en_juego",
  });

  // Si no existe, tomar la primera pendiente.
  if (!currentRound) {
    currentRound = await Rounds.findOne({
      stage: match.stage,
      status: "pendiente",
    }).sort({ round: 1 });
  }

  if (!currentRound) {
    throw new FastifyError("No existen jornadas pendientes.");
  }

  if (!currentRound._id.equals(match.round)) {
    throw new FastifyError(
      `Debe finalizar primero la jornada ${currentRound.round}.`,
    );
  }
}

async function validateCanCancel(match: MatchDocument) {
  const report = await MatchReport.findOne({
    match: match._id,
  });
  const eventos = await matchEventService.countDocuments({
    match: match._id,
  });
  if (!report) {
    return;
  }

  if (
    eventos > 0 ||
    report._movements.length > 1 ||
    report.referee ||
    report.refereeReport ||
    report.vocalReport ||
    report.observations ||
    report.income
  ) {
    throw new FastifyError(
      "No se puede cancelar un partido que ya tiene información registrada.",
    );
  }
}

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
    const match = await Partidos.findOne({
      _id: id,
      league: req.payload.league,
    });
    if (!match) {
      throw new FastifyError("Partido no encontrado");
    }
    if (match.status !== "programado") {
      throw new FastifyError(
        "El partido ya ha sido iniciado o finalizado, no se puede iniciar nuevamente.",
      );
    }
    await validateCurrentRound(match);
    const vocalia = await createReport(match, req.payload.user);
    match.status = "en_juego";
    match.matchReport = vocalia._id;
    const inicio = await getMovimiento({
      type: "started",
      user: req.payload.user,
    });
    match._movements.push(inicio);
    await match.save();
    // Poner la jornada en juego si es que estaba pendiente.
    await Rounds.findOneAndUpdate(
      { _id: match.round, status: "pendiente" },
      { status: "en_juego" },
    );
    // Poner LA ETAPA en juego si es que estaba Generada.
    await Campeonatos.updateOne(
      {
        _id: match.championship,
        stages: {
          $elemMatch: {
            _id: match.stage,
            status: "generada",
          },
        },
      },
      {
        $set: {
          "stages.$.status": "en_juego",
        },
      },
    );
    reply.send(vocalia);
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
    const match = await Partidos.findOne({
      _id: id,
      league: req.payload.league,
    });
    if (!match) {
      throw new FastifyError("Partido no encontrado");
    }
    debug("Revirtiendo el informe de la vocalia");
    /**
     * Verificar si el partido ya tiene eventos registrados o si el informe
     * tiene información registrada para poder eliminar la vocalia
     *
     */
    await validateCanCancel(match);
    await MatchReport.findOneAndDelete({
      match: match._id,
    });
    match.status = "programado";
    const revert = await getMovimiento({
      type: "reverted",
      user: req.payload.user,
      nota: `Partido revertido a programado`,
    });
    match._movements.push(revert);
    await match.save();
    /**
     * Verificar si hay otros partidos en juego en la misma jornada, caso contrario
     * actualizar el estado de la jornada a pendiente
     */
    const playing = await Partidos.countDocuments({
      round: match.round,
      status: "en_juego",
      _id: { $ne: match._id },
    });

    if (playing === 0) {
      await Rounds.findByIdAndUpdate(match.round, {
        status: "pendiente",
      });
      await Campeonatos.updateOne(
        {
          _id: match.championship,
          stages: {
            $elemMatch: {
              _id: match.stage,
              status: "en_juego",
            },
          },
        },
        { $set: { "stages.$.status": "generada" } },
      );
    }
    reply.send({
      success: true,
      data: match,
    });
  },
  /**
   * Registra o corrige los penales de un partido de eliminación directa que ya
   * terminó empatado (por ejemplo, partidos cerrados antes de que la vocalía
   * exigiera penales).
   *
   * Reglas:
   * - Solo etapas knockout, partido finalizado/suspendido y empatado en goles.
   * - Penales enteros ≥ 0 y distintos (debe haber ganador).
   * - Si ya había penales y el cambio invierte al ganador, no se permite cuando
   *   con ese resultado ya se generó la ronda o etapa siguiente.
   * - Si la etapa estaba esperando este dato, continúa sola (siguiente ronda,
   *   cierre de etapa); si cambia el ganador de la final, se recalcula el podio.
   */
  updatePenalties: async (
    req: FastifyRequest<{
      Params: { id: string };
      Body: { localPenalties: number; visitorPenalties: number };
    }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    const { localPenalties, visitorPenalties } = req.body ?? ({} as any);

    const match = await Partidos.findOne({ _id: id, league: req.payload.league });
    if (!match) {
      throw new FastifyError("Partido no encontrado", 404);
    }
    const championship = await Campeonatos.findOne({
      _id: match.championship,
      league: req.payload.league,
    });
    const stage = championship?.stages.id(match.stage);
    if (!championship || !stage) {
      throw new FastifyError("No se encontró la etapa del partido", 404);
    }
    if (stage.mode !== "knockout") {
      throw new FastifyError(
        "Solo los partidos de eliminación directa se definen por penales.",
      );
    }
    if (!["finalizado", "suspendido"].includes(match.status)) {
      throw new FastifyError(
        "El partido aún no termina: los penales se registran al finalizar la vocalía.",
      );
    }
    if ((match.localGoals ?? 0) !== (match.visitorGoals ?? 0)) {
      throw new FastifyError(
        "El partido no terminó empatado: no necesita penales.",
      );
    }
    const valid = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
    if (!valid(localPenalties) || !valid(visitorPenalties)) {
      throw new FastifyError(
        "Indique los penales de ambos equipos (números enteros desde 0).",
      );
    }
    if (localPenalties === visitorPenalties) {
      throw new FastifyError("Los penales no pueden terminar empatados.");
    }

    const hadPenalties =
      typeof match.localPenalties === "number" &&
      typeof match.visitorPenalties === "number";
    const previousLocalWins = hadPenalties
      ? match.localPenalties! > match.visitorPenalties!
      : undefined;
    const localWins = localPenalties > visitorPenalties;
    const winnerChanges =
      previousLocalWins !== undefined && previousLocalWins !== localWins;

    if (winnerChanges) {
      const round = await Rounds.findById(match.round);
      const [laterRound] = await Promise.all([
        Rounds.exists({
          championship: championship._id,
          stage: stage._id,
          round: { $gt: round?.round ?? 0 },
        }),
      ]);
      const nextStage = championship.stages.find(
        (s) => s.order === stage.order + 1,
      );
      if (laterRound || (nextStage && nextStage.status !== "pendiente")) {
        throw new FastifyError(
          "No se puede cambiar el ganador: con este resultado ya se generó la siguiente ronda o etapa. Elimine primero ese fixture.",
        );
      }
    }

    const before = hadPenalties
      ? `${match.localPenalties}-${match.visitorPenalties}`
      : "sin registrar";
    match.localPenalties = localPenalties;
    match.visitorPenalties = visitorPenalties;
    match._movements.push(
      await getMovimiento({
        type: "edit",
        user: req.payload.user,
        nota: `Penales ${localPenalties}-${visitorPenalties} (antes: ${before})`,
      }),
    );
    await match.save();

    // Los penales ya quedaron guardados: si la etapa aún no puede avanzar
    // (p. ej. otro partido de la ronda también está empatado sin penales),
    // se informa como aviso en lugar de error.
    let warning: string | undefined;
    try {
      // Continúa la etapa si estaba esperando este resultado (idempotente)
      await championship.afterRoundFinished(match.round);
      // Si el campeonato ya terminó y cambió un ganador, recalcula el podio
      if (winnerChanges || !hadPenalties) {
        const fresh = await Campeonatos.findById(championship._id);
        if (fresh?.status === "finalizado") {
          await fresh.finishChampionship();
        }
      }
    } catch (error: any) {
      warning = error?.message;
    }

    reply.send({ ...match.toObject(), warning });
  },
};
