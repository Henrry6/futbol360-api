import Debug from "debug";
import { model, Types } from "mongoose";
import Partidos from "../matchs/service";
import { Collections } from "@/libs/useful";
import { FastifyError, getMovimiento, msqTemporalOptions } from "@/libs/utils";
import mongooseSmartQuery from "mongoose-smart-query";
import MatchReportSchema, {
  MatchReport,
  VocaliaModel,
} from "../../models/matchs/matchReport";
const debug = Debug("src:modules:matchReports:service");

MatchReportSchema.plugin(mongooseSmartQuery, {
  defaultFields:
    "league round stage match championship status startTime vocal income observations local visitor",
  fieldsForDefaultQuery: "observations status",
  ...msqTemporalOptions,
});

MatchReportSchema.index({
  championship: 1,
  stage: 1,
  status: 1,
});

MatchReportSchema.pre("save", async function (this) {
  if (this.isNew) {
    console.log("Vocalia nueva, validando jornada actual...");
    // const match = await Partidos.findById(this.match).select("status");
    // if (!match) {
    //   throw new FastifyError("El partido no existe.");
    // }
    // if (match.status === "finalizado") {
    //   throw new FastifyError(
    //     "No se puede crear una vocalía para un partido finalizado.",
    //   );
    // }
    // match.status = "en_juego";
    // match.save();
  }
});

MatchReportSchema.methods.finish = async function (
  status: "finalizada" | "suspendido",
  user: Types.ObjectId,
) {
  debug("Finalizando vocalia");
  if (this.status === "finalizada") {
    throw new FastifyError("La vocalía ya fue finalizada.");
  }
  if (!this.endTime) {
    this.endTime = new Date();
  }
  this.status = status;
  this._movements.push(
    await getMovimiento({
      user,
      type: status,
    }),
  );
  await this.save();

  await Partidos.updateOne(
    { _id: this.match },
    {
      status: "finalizado",
    },
  );
};

const Vocalias = model<MatchReport, VocaliaModel>(
  Collections.MATCHS_REPORTS,
  MatchReportSchema,
);

export default Vocalias;
