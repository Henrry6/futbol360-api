import { model } from "mongoose";
import { msqTemporalOptions } from "@/libs/utils";
import UserSchema, { User } from "../../models/users";
import mongooseSmartQuery from "mongoose-smart-query";

UserSchema.plugin(mongooseSmartQuery, {
  defaultFields: "name username role leagues email official status",
  fieldsForDefaultQuery: "name username",
  ...msqTemporalOptions,
});

export default model<User>("users", UserSchema);
