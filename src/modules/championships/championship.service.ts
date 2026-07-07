import { model, Types } from "mongoose";
import Rounds from "@/modules/rounds/service";
import Match from "@/modules/matchs/service";
import { Collections } from "@/libs/useful";
import { getCompetition } from "./competicion";
import mongooseSmartQuery from "mongoose-smart-query";
import { FastifyError, msqTemporalOptions } from "@/libs/utils";
import ChampionshipSchema, {
  Championship,
  ChampionshipDocument,
  ChampionshipModel,
} from "../../models/champions";

ChampionshipSchema.plugin(mongooseSmartQuery, {
  defaultFields:
    "name league categoy teams stages currentStage champion runnerUp thirdPlace status observations",
  fieldsForDefaultQuery: "name code",
  ...msqTemporalOptions,
});

ChampionshipSchema.methods.generateFixture = async function (
  this: ChampionshipDocument,
) {
  const stage = this.stages.find((s) => s.status === "pendiente");

  if (!stage) {
    throw new FastifyError("No existen etapas pendientes");
  }

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
      console.log(rounds, stageId, this._id, "XXX");
      if (rounds.length === 0) {
        throw new FastifyError("No existen rondas generadas en esa etapa");
      }
      const roundIds = rounds.map((r) => r._id);

      // Validar que no existan partidos jugados
      const existsPlayedMatch = await Match.exists({
        round: { $in: roundIds },
        status: { $in: ["en_juego", "finalizado"] },
      }).session(session);

      if (existsPlayedMatch) {
        throw new FastifyError(
          "No se puede eliminar una etapa que ya tiene partidos jugados.",
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

export default model<Championship, ChampionshipModel>(
  Collections.CHAMPIONSHIPS,
  ChampionshipSchema,
);
