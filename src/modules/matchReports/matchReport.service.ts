import Debug from "debug";
import { model, Types } from "mongoose";
import Partidos from "../matchs/service";
import { Collections } from "@/libs/useful";
import { FastifyError, getMovimiento, msqTemporalOptions } from "@/libs/utils";
import mongooseSmartQuery from "mongoose-smart-query";
import MatchReportSchema, {
  MatchReport,
  VocaliaDocument,
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

MatchReportSchema.methods.finish = async function (
  status: "finalizado" | "suspendido",
  user: Types.ObjectId,
) {
  debug("Finalizando vocalia");
  if (this.status === "finalizada") {
    throw new FastifyError("La vocalía ya fue finalizada.");
  }
  if (!this.endTime) {
    this.endTime = new Date();
  }
  this.status = "finalizada";
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
      status,
    },
  );
};

const Vocalias = model<MatchReport, VocaliaModel>(
  Collections.MATCHS_REPORTS,
  MatchReportSchema,
);

export default Vocalias;
