import bcrypt from "bcryptjs";
import { User } from "@/models/users";
import { Collections } from "./useful";
import { model, Schema, SchemaTypes, Types } from "mongoose";
import { deepmergeCustom, DeepMergeLeafURI } from "deepmerge-ts";

export const deepmerge = deepmergeCustom<{
  DeepMergeArraysURI: DeepMergeLeafURI;
}>({
  mergeArrays: false,
});

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export class FastifyError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function getUsersInfo(
  idsUsuarios: Types.ObjectId[],
): Promise<Pick<User, "_id" | "name" | "username">[]> {
  const users = await model<User>(Collections.USERS)
    .find(
      { _id: { $in: idsUsuarios } },
      { name: 1, username: 1, firmaCargada: 1 },
    )
    .lean();
  return users;
}

export type TiposMovimiento =
  | "created"
  | "transferencia"
  | "deleted"
  | "edit"
  | "issued"
  | "draft"
  | "failed";

/**
 * Obtiene información del movimiento para poder agregarlo al array de
 * movimientos.
 */
export const getMovimiento = async (args: {
  user?: Types.ObjectId;
  type: TiposMovimiento;
  business?: Types.ObjectId;
  nota?: string;
  infoAdicional?: string;
  esEmpleado?: boolean;
}) => {
  // debug('agregando información de movimiento %o', args)
  const [user] = args.user ? await getUsersInfo([args.user]) : [];
  let nota = args.nota || "";
  const accionPor = user ? ` por ${user.name}` : "";
  if (!nota) {
    switch (args.type) {
      case "created":
        nota = "Creado";
        break;
      case "transferencia":
        nota = "Transferido";
        break;
      case "deleted":
        nota = "Eliminado";
        break;
      case "edit":
        nota = "Editado";
        break;
      case "issued":
        nota = "Emitido";
        break;
      case "draft":
        nota = "Guardado como borrador";
        break;
      case "failed":
        nota = "Fallido";
        break;
    }
  }
  nota += accionPor;
  nota += args?.infoAdicional || "";
  return { type: args.type, user: args.user, nota };
};

export interface Movement {
  type: TiposMovimiento;
  date?: Date;
  user?: Types.ObjectId;
  nota?: string;
  mostrarBadge?: boolean;
}

export const Movement = new Schema<Movement>(
  {
    type: { type: String, required: true },
    date: { type: SchemaTypes.Date, default: () => new Date() },
    user: Types.ObjectId,
    nota: String,
    mostrarBadge: Boolean,
  },
  { _id: false },
);

export const msqTemporalOptions = {
  pageQueryName: "page",
  limitQueryName: "limit",
  fieldsQueryName: "fields",
  sortQueryName: "sort",
  queryName: "q",
};
