import { model, Types } from "mongoose";
import { Collections } from "@/libs/useful";
import Rounds from "@/modules/rounds/service";
import mongooseSmartQuery from "mongoose-smart-query";
import { FastifyError, msqTemporalOptions } from "@/libs/utils";
import MatchReport from "@/modules/matchReports/matchReport.service";
import MatchSchema, {
  Match,
  MatchDocument,
  MatchModel,
} from "../../models/matchs/match";
import matchEventService from "../matchEvents/matchEvent.service";

async function createReport(match: MatchDocument, vocalId: Types.ObjectId) {
  return MatchReport.create({
    championship: match.championship,
    stage: match.stage,
    round: match.round,
    match: match._id,
    status: "en_juego",
    startTime: new Date(),
    vocal: vocalId,
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
    _movements: [],
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
      `Debe jugarse primero la jornada ${currentRound.round}.`,
    );
  }
}

async function startRound(match: MatchDocument) {
  await Rounds.findOneAndUpdate(
    { _id: match.round, status: "pendiente" },
    { status: "en_juego" },
  );
}

MatchSchema.plugin(mongooseSmartQuery, {
  defaultFields: `names league round { name round } stage championship \ 
localTeam { logo name } visitorTeam { logo name } date status localGoals \
visitorGoals`,
  fieldsForDefaultQuery: "observations",
  ...msqTemporalOptions,
});

MatchSchema.index({
  championship: 1,
  stage: 1,
  status: 1,
});

/**
 *
 * @param vocalId
 * @returns el partido puesto en juego:
 * - actualiza la ronda y el partido el status a  "en_juego"
 * - Crea el documento de la vocalia
 */
MatchSchema.methods.start = async function (vocalId) {
  if (this.status !== "programado") {
    throw new FastifyError("El partido ya inició.");
  }
  await validateCurrentRound(this);
  await createReport(this, vocalId);
  this.status = "en_juego";
  await this.save();
  await startRound(this);
  return this;
};

async function deleteReport(match: MatchDocument) {
  await MatchReport.findOneAndDelete({
    match: match._id,
  });
}

async function rollbackRound(match: MatchDocument) {
  const playing = await Partidos.countDocuments({
    round: match.round,
    status: "en_juego",
    _id: { $ne: match._id },
  });

  if (playing === 0) {
    await Rounds.findByIdAndUpdate(match.round, {
      status: "pendiente",
    });
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
    report._movements.length ||
    report.referee ||
    report.refereeReport ||
    report.vocalReport ||
    report.observations ||
    report.income ||
    report.attendance
  ) {
    throw new FastifyError(
      "No se puede cancelar un partido que ya tiene información registrada.",
    );
  }
}

MatchSchema.methods.revertStart = async function () {
  if (this.status !== "en_juego") {
    throw new FastifyError("El partido no está en juego.");
  }

  await validateCanCancel(this);
  await deleteReport(this);

  this.status = "programado";
  await this.save();
  await rollbackRound(this);
  return this;
};

const Partidos = model<Match, MatchModel>(Collections.MATCHES, MatchSchema);
export default Partidos;
