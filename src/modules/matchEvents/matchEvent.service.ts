import { model } from "mongoose";
import { Collections } from "@/libs/useful";
import { msqTemporalOptions } from "@/libs/utils";
import mongooseSmartQuery from "mongoose-smart-query";
import MatchEventSchema, { MatchEvent } from "../../models/matchs/matchEvent";

MatchEventSchema.plugin(mongooseSmartQuery, {
  defaultFields: "round stage championship player minute type observations",
  fieldsForDefaultQuery: "observations type player",
  ...msqTemporalOptions,
});

MatchEventSchema.index({
  match: 1,
  minute: 1,
});

export default model<MatchEvent>(Collections.MATCHS_EVENTS, MatchEventSchema);
