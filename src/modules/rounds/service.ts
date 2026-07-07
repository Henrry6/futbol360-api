import { model } from "mongoose";
import { Collections } from "@/libs/useful";
import { msqTemporalOptions } from "@/libs/utils";
import mongooseSmartQuery from "mongoose-smart-query";
import RoundSchema, { Round } from "../../models/rounds";

RoundSchema.plugin(mongooseSmartQuery, {
  defaultFields: "names league round championship status stage",
  fieldsForDefaultQuery: "names ",
  ...msqTemporalOptions,
});

export default model<Round>(Collections.ROUNDS, RoundSchema);
