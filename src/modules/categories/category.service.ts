import { model } from "mongoose";
import { msqTemporalOptions } from "@/libs/utils";
import mongooseSmartQuery from "mongoose-smart-query";
import CategoySchema, { Category } from "@/models/categories";

CategoySchema.plugin(mongooseSmartQuery, {
  defaultFields: "name league status minAge maxAge",
  fieldsForDefaultQuery: "name minAge maxAge",
  ...msqTemporalOptions,
});

export default model<Category>("categories", CategoySchema);
