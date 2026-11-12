import Debug from "debug";
import mongoose, { ClientSession, model, Types } from "mongoose";
import Match from "@/modules/matchs/service";
import { Collections } from "@/libs/useful";
import { getStageParticipants } from "./competicion/participants";
import Rounds from "@/modules/rounds/service";
import { getCompetition } from "./competicion";
import Players from "../players/player.service";
import mongooseSmartQuery from "mongoose-smart-query";
import Vocalias from "../matchReports/matchReport.service";
import { calculateStandings } from "./competicion/standings";
import { FastifyError, getMovimiento, msqTemporalOptions } from "@/libs/utils";
import ChampionshipSchema, {
  Championship,
  ChampionshipDocument,
  ChampionshipModel,
  ChampionshipStage,
} from "../../models/champions";
const debug = Debug("src:modules:championships:championship.service");

ChampionshipSchema.plugin(mongooseSmartQuery, {
  defaultFields:
    "name league category { name } teams stages currentStage champion runnerUp thirdPlace status observations",
  fieldsForDefaultQuery: "name code",
  ...msqTemporalOptions,
});
ChampionshipSchema.pre("save", { document: true }, async function () {
  const campeonato = this;

  const equiposActivos = campeonato.teams.filter(
    (team) => team.status === "activo",
  );

  for (const equipo of equiposActivos) {
    const jugadoresActivos = await Players.countDocuments({
      team: equipo.team,
      status: "activo",
    });

    // if (jugadoresActivos < 15) {
    //   throw new Error(
    //     `El equipo ${equipo.team} debe tener al menos 15 jugadores activos. Actualmente tiene ${jugadoresActivos}.`,
    //   );
    // }
  }
});

ChampionshipSchema.pre("deleteOne", { document: true }, async function (this) {
  const championshipId = this._id;

  const [matches] = await Promise.all([
    Match.exists({ championship: championshipId }),
  ]);

  if (this.teams.length > 0) {
    throw new FastifyError(
      "No puede eliminar el campeonato porque existen equipos asociados.",
    );
  }
  if (matches) {
    throw new FastifyError(
      "No puede eliminar el campeonato porque existen partidos generados.",
    );
  }
});

/**
 * Ejecuta `fn` dentro de una transacción (requiere MongoDB en replica set).
 * Si algo falla, no queda ninguna jornada ni partido a medias.
 */
async function inTransaction<T>(fn: (session: ClientSession) => Promise<T>) {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function findStage(
  championship: ChampionshipDocument,
  stageId: Types.ObjectId | string,
) {
  const stage = championship.stages.id(stageId);
  if (!stage) throw new FastifyError("No se encontró la etapa.");
  return stage;
}

/**
 * Genera jornadas y partidos de una etapa según su modo.
 * Requiere la etapa en "pendiente" y, si no es la primera, la anterior finalizada.
 */
ChampionshipSchema.methods.generateFixture = async function (
  this: ChampionshipDocument,
  etapa: ChampionshipStage,
) {
  const stage = findStage(this, etapa._id);
  debug("Generando fixture para:", stage.name, "con modo:", stage.mode);
  if (stage.status !== "pendiente") {
    throw new FastifyError("La etapa ya fue generada.");
  }

  const competition = getCompetition(stage.mode);
  const participants = await getStageParticipants(this, stage);
  competition.validate(stage, participants.seeds);

  await inTransaction(async (session) => {
    await competition.generateFixture(this, stage, participants, session);
    stage.status = "generada";
    this.currentStage = stage._id;
    await this.save({ session });
  });
};

/**
 * Elimina jornadas y partidos de una etapa y la devuelve a "pendiente".
 * No se permite si hay vocalías, partidos jugados o si la etapa siguiente ya
 * fue generada (dependen de los clasificados de esta).
 */
ChampionshipSchema.methods.deleteFixture = async function (
  this: ChampionshipDocument,
  stageId: string,
) {
  const stage = findStage(this, stageId);
  const nextStage = this.stages.find((s) => s.order === stage.order + 1);
  if (nextStage && nextStage.status !== "pendiente") {
    throw new FastifyError(
      `Primero elimine el fixture de la etapa siguiente (${nextStage.name}).`,
    );
  }

  await inTransaction(async (session) => {
    const rounds = await Rounds.find(
      { championship: this._id, stage: stage._id },
      { _id: 1 },
    ).session(session);
    if (rounds.length === 0) {
      throw new FastifyError("No existen Jornadas generadas en esa etapa");
    }
    const roundIds = rounds.map((r) => r._id);

    const existsVocalias = await Vocalias.exists({
      round: { $in: roundIds },
    }).session(session);
    if (existsVocalias) {
      throw new FastifyError(
        "No se puede eliminar una etapa que ya tiene vocalías generadas.",
      );
    }
    const existsPlayedMatch = await Match.exists({
      round: { $in: roundIds },
      status: { $in: ["en_juego", "finalizado"] },
    }).session(session);
    if (existsPlayedMatch) {
      throw new FastifyError(
        "No se puede eliminar una etapa que ya tiene partidos en juego o finalizados.",
      );
    }
    await Match.deleteMany({ round: { $in: roundIds } }, { session });
    await Rounds.deleteMany({ _id: { $in: roundIds } }, { session });

    stage.status = "pendiente";
    stage.groupsTeams = undefined;
    await this.save({ session });
  });
};

/**
 * Etapa pedida o, si no se indica, la "actual":
 * la que está en juego → la generada → la última finalizada → la primera.
 */
ChampionshipSchema.methods.getCurrentStage = function (
  this: ChampionshipDocument,
  stageId?: Types.ObjectId,
): ChampionshipStage {
  if (stageId) return findStage(this, stageId);

  const byOrder = [...this.stages].sort((a, b) => a.order - b.order);
  const stage =
    byOrder.find((s) => s.status === "en_juego") ??
    byOrder.find((s) => s.status === "generada") ??
    [...byOrder].reverse().find((s) => s.status === "finalizada") ??
    byOrder[0];
  if (!stage) {
    throw new FastifyError("No se encontró la etapa.");
  }
  return stage;
};

ChampionshipSchema.methods.tablePositions = async function (
  this: ChampionshipDocument,
  stageId?: Types.ObjectId,
) {
  const stage = this.getCurrentStage(stageId);
  if (stage.mode === "knockout") {
    throw new FastifyError("La etapa no tiene tabla de posiciones.");
  }
  return calculateStandings(this, stage);
};

ChampionshipSchema.methods.nextRound = async function (
  this: ChampionshipDocument,
  stageId: Types.ObjectId | string,
) {
  const stage = findStage(this, stageId);
  return inTransaction((session) =>
    getCompetition(stage.mode).nextRound(this, stage, session),
  );
};

/**
 * Se ejecuta al cerrar la última vocalía de una jornada:
 * 1. Si quedan jornadas sin terminar en la etapa, no hace nada.
 * 2. Si el modo necesita otra ronda (knockout), la crea.
 * 3. Si no, finaliza la etapa; y si era la última, finaliza el campeonato.
 */
ChampionshipSchema.methods.afterRoundFinished = async function (
  this: ChampionshipDocument,
  roundId: Types.ObjectId | string,
) {
  const round = await Rounds.findOne({ _id: roundId, championship: this._id });
  if (!round) return;
  const stage = findStage(this, round.stage);
  if (stage.status === "finalizada") return; // ya procesada (idempotente)

  const pendingRounds = await Rounds.countDocuments({
    championship: this._id,
    stage: stage._id,
    status: { $ne: "finalizado" },
  });
  if (pendingRounds > 0) return;

  if (await this.nextRound(stage._id)) {
    debug("Nueva ronda creada en", stage.name);
    return;
  }

  debug("Finalizando la etapa", stage.name);
  stage.status = "finalizada";
  await this.save();

  const isLastStage = this.stages.every((s) => s.order <= stage.order);
  if (isLastStage) {
    await this.finishChampionship();
  }
};

/**
 * Cierra el campeonato con el podio de la última etapa:
 * - liga: 1º, 2º y 3º de la tabla;
 * - knockout: ganador y perdedor de la final, ganador del 3er lugar;
 * - grupos: sin campeón (debe haber una etapa final después).
 */
ChampionshipSchema.methods.finishChampionship = async function (
  this: ChampionshipDocument,
) {
  const lastStage = [...this.stages].sort((a, b) => b.order - a.order)[0];
  if (!lastStage || lastStage.status !== "finalizada") {
    throw new FastifyError("La última etapa del campeonato aún no ha finalizado.");
  }

  const podium = await getCompetition(lastStage.mode).getPodium(this, lastStage);
  this.champion = podium.champion;
  this.runnerUp = podium.runnerUp;
  this.thirdPlace = podium.thirdPlace;

  const positions: [Types.ObjectId | undefined, number][] = [
    [podium.champion, 1],
    [podium.runnerUp, 2],
    [podium.thirdPlace, 3],
  ];
  for (const [team, position] of positions) {
    const entry = team && this.teams.find((t) => t.team.equals(team));
    if (entry) entry.finalPosition = position;
  }

  this.status = "finalizado";
  this.endDate = new Date();
  this._movements.push(await getMovimiento({ type: "finalizado" }));
  await this.save();
};

export default model<Championship, ChampionshipModel>(
  Collections.CHAMPIONSHIPS,
  ChampionshipSchema,
);
