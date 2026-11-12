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
};
