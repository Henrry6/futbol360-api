import { model } from "mongoose";
import UserSchema, { User } from "../../models/users";
import mongooseSmartQuery from "mongoose-smart-query";
import Liga from "@/modules/leagues/leagues.service";
import {
  FastifyError,
  hashPassword,
  msqTemporalOptions,
  sendMail,
} from "@/libs/utils";
import { welcomeEmailTemplate } from "@/libs/templates-emails";

UserSchema.plugin(mongooseSmartQuery, {
  defaultFields: "name username role leagues email",
  fieldsForDefaultQuery: "name username",
  ...msqTemporalOptions,
});

export default model<User>("users", UserSchema);
