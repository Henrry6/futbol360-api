import { model } from "mongoose";
import { Collections } from "@/libs/useful";
import { msqTemporalOptions } from "@/libs/utils";
import mongooseSmartQuery from "mongoose-smart-query";
import MatchSchema, { Match, MatchModel } from "../../models/matchs/match";

MatchSchema.plugin(mongooseSmartQuery, {
  defaultFields: `names league round { name round } stage championship \ 
localTeam { logo name } visitorTeam { logo name } date status localGoals \
visitorGoals hour vocal { name } referee { name } assistantReferees { name } \
observations _movements`,
  fieldsForDefaultQuery: "observations date",
  ...msqTemporalOptions,
});

MatchSchema.index({
  championship: 1,
  stage: 1,
  status: 1,
});

const Partidos = model<Match, MatchModel>(Collections.MATCHES, MatchSchema);
export default Partidos;
