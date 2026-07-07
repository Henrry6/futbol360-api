import { model } from "mongoose";
import { Collections } from "@/libs/useful";
import { msqTemporalOptions } from "@/libs/utils";
import mongooseSmartQuery from "mongoose-smart-query";
import FixtureSchema, { Fixture } from "../../models/fixture";

FixtureSchema.plugin(mongooseSmartQuery, {
  defaultFields: "names league round championship status stage",
  fieldsForDefaultQuery: "names ",
  ...msqTemporalOptions,
});

export default model<Fixture>(Collections.FIXTURES, FixtureSchema);
