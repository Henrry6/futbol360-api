import { model } from "mongoose";
import { msqTemporalOptions } from "@/libs/utils";
import UserSchema, { User } from "../../models/users";
import mongooseSmartQuery from "mongoose-smart-query";

UserSchema.plugin(mongooseSmartQuery, {
  defaultFields: "name username roles leagues email official status",
  // smartQuery usa agregaciones, que ignoran `select: false`
  protectedFields: "password",
  fieldsForDefaultQuery: "name username",
  ...msqTemporalOptions,
});

export default model<User>("users", UserSchema);
