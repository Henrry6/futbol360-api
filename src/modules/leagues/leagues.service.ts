import { model } from "mongoose";
import Users from "../users/users.service";
import mongooseSmartQuery from "mongoose-smart-query";
import LeagueSchema, { League, LigaModel } from "../../models/leagues";
import { FastifyError, getMovimiento, msqTemporalOptions } from "@/libs/utils";

LeagueSchema.plugin(mongooseSmartQuery, {
  defaultFields: "name code status description",
  fieldsForDefaultQuery: "name code",
  ...msqTemporalOptions,
});

LeagueSchema.statics.createDocument = async function (body, args = {}) {
  const creador = await getMovimiento({
    type: "created",
    user: args.user,
  });
  const liga = new this(body);
  liga._movements = [creador];
  const usuario = await Users.findById(args.user);
  if (usuario) {
    usuario?.leagues.push(liga._id);
    usuario?.save();
  } else {
    throw new FastifyError("La liga no puede ser asignada a un usuario");
  }
  await liga.save();
  return liga;
} as LigaModel["createDocument"];

export default model<League, LigaModel>("leagues", LeagueSchema);
