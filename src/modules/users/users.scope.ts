import Users from "./users.service";
import { User } from "@/models/users";
import { FastifyRequest } from "fastify";
import { FastifyError } from "@/libs/utils";
import { FilterQuery, Types } from "mongoose";

/**
 * Qué usuarios puede ver y administrar quien hace la petición.
 *
 * - Sesión de liga (token con `league`, por /auth/login): solo los usuarios de
 *   esa liga, sea cual sea el rol (también master o admin).
 * - Área de administración (token sin liga, por /auth/admin/login):
 *     · master → todos los usuarios;
 *     · admin  → los usuarios de cualquiera de las ligas que administra.
 * - Cualquier otro caso → solo él mismo.
 */
export async function getUsersScope(
  request: FastifyRequest,
): Promise<FilterQuery<User>> {
  const { league, roles = [], user } = request.payload;

  if (league) {
    return { leagues: new Types.ObjectId(String(league)) };
  }
  if (roles.includes("master")) {
    return {};
  }
  if (roles.includes("admin")) {
    return { leagues: { $in: await getManagedLeagues(request) } };
  }
  return { _id: new Types.ObjectId(String(user)) };
}

/**
 * Ligas que quien hace la petición puede asignar a un usuario.
 * `null` = cualquiera (master en el área de administración).
 */
export async function getManagedLeagues(
  request: FastifyRequest,
): Promise<Types.ObjectId[]>;
export async function getManagedLeagues(
  request: FastifyRequest,
  options: { allowAll: true },
): Promise<Types.ObjectId[] | null>;
export async function getManagedLeagues(
  request: FastifyRequest,
  options?: { allowAll: true },
): Promise<Types.ObjectId[] | null> {
  const { league, roles = [], user } = request.payload;
  if (league) return [new Types.ObjectId(String(league))];
  if (options?.allowAll && roles.includes("master")) return null;
  const me = await Users.findById(user, { leagues: 1 }).lean();
  return me?.leagues ?? [];
}

/**
 * Calcula las ligas finales de un usuario al crearlo o editarlo.
 *
 * Quien edita solo puede agregar o quitar ligas que administra; las demás
 * ligas que el usuario ya tenía se conservan. Así, por ejemplo, editar desde la
 * liga A a un usuario de A y B no le quita B (el formulario envía solo [A]).
 *
 * - `requested` undefined → no se cambian las ligas (devuelve undefined).
 * - master en el área de administración → se usa lo enviado tal cual.
 * - Pedir una liga que no administra (y que el usuario no tenía) → 403.
 */
export async function resolveUserLeagues(
  request: FastifyRequest,
  current: Types.ObjectId[],
  requested: unknown,
): Promise<Types.ObjectId[] | undefined> {
  if (requested === undefined || requested === null) return undefined;
  const requestedIds = (Array.isArray(requested) ? requested : [requested]).map(
    (id) => new Types.ObjectId(String(id)),
  );

  const managed = await getManagedLeagues(request, { allowAll: true });
  if (managed === null) return unique(requestedIds); // master

  const managedSet = new Set(managed.map(String));
  const currentSet = new Set(current.map(String));
  const forbidden = requestedIds.filter(
    (id) => !managedSet.has(String(id)) && !currentSet.has(String(id)),
  );
  if (forbidden.length > 0) {
    throw new FastifyError(
      "Solo puede asignar usuarios a las ligas que administra.",
      403,
    );
  }

  const kept = current.filter((id) => !managedSet.has(String(id)));
  const chosen = requestedIds.filter((id) => managedSet.has(String(id)));
  return unique([...kept, ...chosen]);
}

function unique(ids: Types.ObjectId[]) {
  const seen = new Map(ids.map((id) => [String(id), id]));
  return [...seen.values()];
}
