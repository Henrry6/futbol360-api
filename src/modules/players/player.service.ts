import { model } from "mongoose";
import { msqTemporalOptions } from "@/libs/utils";
import PlayerSchema, { Player } from "../../models/players";
import mongooseSmartQuery from "mongoose-smart-query";

PlayerSchema.plugin(mongooseSmartQuery, {
  defaultFields: "names league cedula lastName status jerseyNumber",
  fieldsForDefaultQuery: "names cedula lastName",
  ...msqTemporalOptions,
});

export default model<Player>("players", PlayerSchema);
