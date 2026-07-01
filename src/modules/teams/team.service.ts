import { model } from "mongoose";
import TeamSchema, { Team } from "../../models/teams";
import mongooseSmartQuery from "mongoose-smart-query";
import { msqTemporalOptions } from "@/libs/utils";

TeamSchema.plugin(mongooseSmartQuery, {
  defaultFields: "name league representative status",
  fieldsForDefaultQuery: "name",
  ...msqTemporalOptions,
});

export default model<Team>("teams", TeamSchema);
