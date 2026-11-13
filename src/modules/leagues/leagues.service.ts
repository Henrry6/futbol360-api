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
  if (!usuario) {
    throw new FastifyError("La liga no puede ser asignada a un usuario");
  }
  // Primero se guarda la liga (valida código y nombre únicos); solo si se creó
  // se asocia al usuario, para no dejar ligas inexistentes en `user.leagues`.
  await liga.save();
  usuario.leagues.push(liga._id);
  await usuario.save();
  return liga;
} as LigaModel["createDocument"];

export default model<League, LigaModel>("leagues", LeagueSchema);
