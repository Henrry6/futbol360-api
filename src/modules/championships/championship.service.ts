import Debug from "debug";
import { model, Types } from "mongoose";
import Match from "@/modules/matchs/service";
import { Collections } from "@/libs/useful";
import Rounds from "@/modules/rounds/service";
import { getCompetition } from "./competicion";
import teamService from "../teams/team.service";
import mongooseSmartQuery from "mongoose-smart-query";
import { calculateStandings } from "./competicion/standings";
import { FastifyError, msqTemporalOptions } from "@/libs/utils";
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

ChampionshipSchema.methods.generateFixture = async function (
  this: ChampionshipDocument,
) {
  const stage = [...this.stages]
    .sort((a, b) => a.order - b.order)
    .find((s) => s.status === "pendiente");

  if (!stage) {
    throw new FastifyError("No existen etapas pendientes");
  }
  debug(
    "Generando fixture para la etapa:",
    stage.name,
    "con modo:",
    stage.mode,
  );

  return getCompetition(stage.mode).generateFixture(this, stage);
};

ChampionshipSchema.methods.deleteFixture = async function (stageId: string) {
  const session = await model(Collections.CHAMPIONSHIPS).startSession();
  try {
    await session.withTransaction(async () => {
      const rounds = await Rounds.find(
        {
          championship: this._id,
          stage: new Types.ObjectId(stageId),
        },
        {
          _id: 1,
        },
      ).session(session);
      if (rounds.length === 0) {
        throw new FastifyError("No existen rondas generadas en esa etapa");
      }
      const roundIds = rounds.map((r) => r._id);

      const existsVocalias = await Match.exists({
        round: { $in: roundIds },
      }).session(session);
      if (existsVocalias) {
        throw new FastifyError(
          "No se puede eliminar una etapa que ya tiene vocalías generadas.",
        );
      }
      // Validar que no existan partidos jugados
      const existsPlayedMatch = await Match.exists({
        round: { $in: roundIds },
        status: { $in: ["en_juego", "finalizado"] },
      }).session(session);
      if (existsPlayedMatch) {
        throw new FastifyError(
          "No se puede eliminar una etapa que ya tiene partidos en juego o finalizados.",
        );
      }
      await Match.deleteMany(
        {
          round: { $in: roundIds },
        },
        { session },
      );
      await Rounds.deleteMany(
        {
          championship: this._id,
          stage: stageId,
        },
        { session },
      );
      const stage = this.stages.id(stageId);
      if (stage) {
        stage.status = "pendiente";
      }

      await this.save({ session });
    });
  } finally {
    await session.endSession();
  }
};

ChampionshipSchema.methods.getCurrentStage = function (
  stageId?: Types.ObjectId,
): ChampionshipStage {
  const stage = stageId
    ? this.stages.find((s) => s._id.equals(stageId))
    : this.stages.find(
        (s) => s.status === "en_juego" || s.status === "finalizada",
      );
  if (!stage) {
    throw new FastifyError(
      "No se encontró la etapa o no existen etapas en juegomon o finalizadas.",
    );
  }

  return stage;
};

ChampionshipSchema.methods.tablePositions = async function (
  stageId?: Types.ObjectId,
) {
  const stage = this.getCurrentStage(stageId);

  if (stage.mode === "knockout") {
    throw new FastifyError("La etapa no tiene tabla de posiciones.");
  }

  return calculateStandings(this, stage);
};

export default model<Championship, ChampionshipModel>(
  Collections.CHAMPIONSHIPS,
  ChampionshipSchema,
);
