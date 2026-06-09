import { model } from "mongoose";
import userSchema, { User } from "../../models/users";
import mongooseSmartQuery from "mongoose-smart-query";
import { msqTemporalOptions } from "@/libs/utils";

userSchema.plugin(mongooseSmartQuery, {
  fieldsForDefaultQuery: "name username password role leagues",
  ...msqTemporalOptions,
});

export default model<User>("users", userSchema);
