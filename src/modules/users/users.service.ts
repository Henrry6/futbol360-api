import { model } from "mongoose";
import UserSchema, { User } from "../../models/users";
import mongooseSmartQuery from "mongoose-smart-query";
import Liga from "@/modules/leagues/leagues.service";
import { FastifyError, msqTemporalOptions } from "@/libs/utils";

UserSchema.plugin(mongooseSmartQuery, {
  defaultFields: "name username role leagues",
  fieldsForDefaultQuery: "name username",
  ...msqTemporalOptions,
});

UserSchema.statics.createDocument = async function (body, args = {}) {
  const usuario = new this(body);
  const liga = await Liga.findById(args.league);
  if (liga) {
    usuario?.leagues.push(liga._id);
    await usuario?.save();
  } else {
    throw new FastifyError("El usuario no se puede asociar a una liga");
  }
  return usuario;
};

export default model<User>("users", UserSchema);
