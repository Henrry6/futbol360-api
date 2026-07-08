import { model } from "mongoose";
import { Collections } from "@/libs/useful";
import { msqTemporalOptions } from "@/libs/utils";
import mongooseSmartQuery from "mongoose-smart-query";
import RoundSchema, { Round } from "../../models/rounds";

RoundSchema.plugin(mongooseSmartQuery, {
  defaultFields: "round name league championship status stage",
  fieldsForDefaultQuery: "name",
  ...msqTemporalOptions,
});

export default model<Round>(Collections.ROUNDS, RoundSchema);
