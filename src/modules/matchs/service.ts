import { model } from "mongoose";
import { Collections } from "@/libs/useful";
import { msqTemporalOptions } from "@/libs/utils";
import mongooseSmartQuery from "mongoose-smart-query";
import MatchSchema, { Match } from "../../models/matchs/match";

MatchSchema.plugin(mongooseSmartQuery, {
  defaultFields:
    "names league round stage championship localTeam visitorTeam date status localGoals visitorGoals",
  fieldsForDefaultQuery: "observations",
  ...msqTemporalOptions,
});

MatchSchema.index({
  championship: 1,
  stage: 1,
  status: 1,
});

export default model<Match>(Collections.MATCHES, MatchSchema);
