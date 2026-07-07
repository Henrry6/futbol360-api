import { model } from "mongoose";
import { Collections } from "@/libs/useful";
import { msqTemporalOptions } from "@/libs/utils";
import mongooseSmartQuery from "mongoose-smart-query";
import MatchSchema, { Player } from "../../models/players";

MatchSchema.plugin(mongooseSmartQuery, {
  defaultFields:
    "names league fixture championship localTeam visitorTeam date status",
  fieldsForDefaultQuery: "observations",
  ...msqTemporalOptions,
});

export default model<Player>(Collections.MATCHES, MatchSchema);
