import { model } from "mongoose";
import ChampionshipSchema, { Championship } from "../../models/champions";
import mongooseSmartQuery from "mongoose-smart-query";
import { msqTemporalOptions } from "@/libs/utils";

ChampionshipSchema.plugin(mongooseSmartQuery, {
  defaultFields: "name league categoy teams",
  fieldsForDefaultQuery: "name code",
  ...msqTemporalOptions,
});

export default model<Championship>("championship", ChampionshipSchema);
