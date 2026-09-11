import { model } from "mongoose";
import { Collections } from "@/libs/useful";
import { msqTemporalOptions } from "@/libs/utils";
import mongooseSmartQuery from "mongoose-smart-query";
import MatchReportSchema, {
  MatchReport,
  VocaliaModel,
} from "../../models/matchs/matchReport";
// const debug = Debug("src:modules:matchReports:service");

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
  }
});

const Vocalias = model<MatchReport, VocaliaModel>(
  Collections.MATCHS_REPORTS,
  MatchReportSchema,
);

export default Vocalias;
