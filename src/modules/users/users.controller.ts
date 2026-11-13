import Debug from "debug";
import { getUserIds } from "@/libs/UpRouter";
import { isValidObjectId, Types } from "mongoose";
import Users from "@/modules/users/users.service";
import { FastifyReply, FastifyRequest } from "fastify";
import Leagues from "@/modules/leagues/leagues.service";
import { getUsersScope, resolveUserLeagues } from "./users.scope";
import {
  deepmerge,
  FastifyError,
  getMovimiento,
  hashPassword,
  sendMail,
} from "@/libs/utils";

import { User } from "@/models/users";
import { welcomeEmailTemplate } from "@/libs/templates-emails";
const debug = Debug("src:modules:users");

/** Solo un master puede crear usuarios master o dar ese rol. */
function assertCanGrantRoles(req: FastifyRequest, roles: unknown) {
  const requested = Array.isArray(roles) ? roles : roles ? [roles] : [];
  if (
    requested.includes("master") &&
    !(req.payload.roles ?? []).includes("master")
  ) {
    throw new FastifyError("Solo un master puede asignar el rol master.", 403);
  }
}

/**
 * Un usuario master solo puede ser editado o eliminado por él mismo: ni un
 * admin ni otro master pueden modificar sus datos.
 */
function assertCanModifyUser(req: FastifyRequest, target: User & { _id: any }) {
  const isSelf = String(target._id) === String(req.payload.user);
  if ((target.roles ?? []).includes("master") && !isSelf) {
    throw new FastifyError(
      "Solo el propio usuario master puede modificar su información.",
      403,
    );
  }
}

/**
 * GET /users — listado limitado al alcance de quien consulta
 * (ver `getUsersScope`). Mantiene búsqueda, filtros, orden y paginación.
 */
async function listUsers(
  req: FastifyRequest<{ Querystring: Record<string, any> }>,
  reply: FastifyReply,
) {
  const scope = await getUsersScope(req);
  const query = { ...req.query };
  delete query.league; // los usuarios tienen `leagues`, no `league`
  const result: any = await Users.smartQuery(query, {
    prePipeline: [{ $match: scope }],
    autoPaginate: true,
  });
  reply.send({
    page: result.pagination.page,
    total: result.pagination.total,
    data: result.data,
  });
}

/** GET /users/:id — 404 si el usuario está fuera del alcance. */
async function getUser(
  req: FastifyRequest<{
    Params: { id: string };
    Querystring: Record<string, any>;
  }>,
  reply: FastifyReply,
) {
  if (!isValidObjectId(req.params.id)) {
    throw new FastifyError("No se encontró el recurso", 404);
  }
  const scope = await getUsersScope(req);
  const query = { ...req.query };
  delete query.league;
  const [usuario] = (await Users.smartQuery(query, {
    prePipeline: [
      { $match: { $and: [{ _id: new Types.ObjectId(req.params.id) }, scope] } },
    ],
  })) as unknown as any[];
  if (!usuario) throw new FastifyError("No se encontró el recurso", 404);
  reply.send(usuario);
}

/** DELETE /users/:id — solo usuarios dentro del alcance y nunca a sí mismo. */
async function deleteUser(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  if (!isValidObjectId(req.params.id)) {
    throw new FastifyError("No se encontró el documento a eliminar", 404);
  }
  if (String(req.payload.user) === req.params.id) {
    throw new FastifyError("No puede eliminar su propio usuario.");
  }
  const scope = await getUsersScope(req);
  const usuario = await Users.findOne({
    $and: [{ _id: req.params.id }, scope],
  });
  if (!usuario) {
    throw new FastifyError("No se encontró el documento a eliminar", 404);
  }
  assertCanModifyUser(req, usuario);
  await usuario.deleteOne();
  reply.send("success");
}

async function createUsers(
  req: FastifyRequest<{ Body: Partial<User> }>,
  reply: FastifyReply,
) {
  debug("Creando usuario nuevo");
  assertCanGrantRoles(req, req.body.roles);
  const leagues = await resolveUserLeagues(req, [], req.body.leagues);
  const usuario = new Users({ ...req.body, leagues: leagues ?? [] });
  const password = req.body.password as string;
  usuario.password = await hashPassword(password);
  if (req.payload.league) {
    const liga = await Leagues.findById(req.payload.league);
    if (!liga) {
      throw new FastifyError("El usuario no se puede asociar a una liga");
    }
    if (!usuario.leagues.some((id) => id.equals(liga._id))) {
      usuario.leagues.push(liga._id);
    }
  }
  await usuario.save();
  try {
    await sendMail({
      to: usuario.email,
      subject: "Bienvenido al sistema",
      html: welcomeEmailTemplate({
        name: usuario.name,
        username: usuario.username,
        password,
      }),
      text: "adicional",
    });
  } catch (e) {
    console.log(e, "No se pudo enviar el correo del usuario");
  }

  reply.send(usuario);
}
async function updateUser(
  req: FastifyRequest<{ Params: { id: string }; Body: Partial<User> }>,
  reply: FastifyReply,
) {
  debug("Editando usuario", req.params.id);
  if (!isValidObjectId(req.params.id)) {
    throw new FastifyError("No se encontró el documento a editar", 404);
  }
  const scope = await getUsersScope(req);
  const documento = await Users.findOne({
    $and: [{ _id: req.params.id }, scope],
  });
  if (!documento)
    throw new FastifyError("No se encontró el documento a editar", 404);
  assertCanModifyUser(req, documento);

  const body: any = { ...req.body };
  delete body._id;
  delete body.__v;
  if (body.password) {
    body.password = await hashPassword(body.password);
  }
  assertCanGrantRoles(req, body.roles);
  const leagues = await resolveUserLeagues(
    req,
    documento.leagues,
    body.leagues,
  );
  if (leagues) body.leagues = leagues;
  else delete body.leagues;

  documento.$locals.docOriginal = documento.toObject();
  documento.set(deepmerge(documento.toObject(), body));
  if (documento.isModified()) {
    documento._movements?.push(
      (await getMovimiento({
        type: "edit",
        ...getUserIds(req),
      })) as never,
    );
    await documento.save();
  }
  reply.send(documento);
}

export default {
  listUsers,
  getUser,
  deleteUser,
  createUsers,
  updateUser,
};
