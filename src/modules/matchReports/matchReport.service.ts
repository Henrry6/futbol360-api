import { model } from "mongoose";
import { Collections } from "@/libs/useful";
import { msqTemporalOptions } from "@/libs/utils";
import mongooseSmartQuery from "mongoose-smart-query";
import MatchReportSchema, {
  MatchReport,
} from "../../models/matchs/matchReport";

MatchReportSchema.plugin(mongooseSmartQuery, {
  defaultFields:
    "league round stage championship status startTime vocal income observations local visitor",
  fieldsForDefaultQuery: "observations status",
  ...msqTemporalOptions,
});

MatchReportSchema.index({
  championship: 1,
  stage: 1,
  status: 1,
});

export default model<MatchReport>(
  Collections.MATCHS_REPORTS,
  MatchReportSchema,
);
