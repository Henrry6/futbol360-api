import Debug from "debug";
import Partidos from "../matchs/service";
import { League } from "@/models/leagues";
import Users from "../users/users.service";
import { getUserIds } from "@/libs/UpRouter";
import Equipos from "@/modules/teams/team.service";
import { FastifyReply, FastifyRequest } from "fastify";
import Leagues from "@/modules/leagues/leagues.service";
import Jugadores from "@/modules/players/player.service";
import { FilterQuery, isValidObjectId, Types } from "mongoose";
import Categorias from "@/modules/categories/category.service";
import { getManagedLeagues } from "@/modules/users/users.scope";
import { deepmerge, FastifyError, getMovimiento } from "@/libs/utils";
import Campeonatos from "@/modules/championships/championship.service";

const debug = Debug("src:modules:leagues:leagues.controller");

/**
 * Ligas visibles para quien consulta:
 * sesión de liga → esa liga; master (área admin) → todas; admin → las suyas.
 */
async function getLeaguesScope(
  req: FastifyRequest,
): Promise<FilterQuery<League>> {
  const managed = await getManagedLeagues(req, { allowAll: true });
  return managed === null ? {} : { _id: { $in: managed } };
}

export default {
  /** GET /leagues — listado limitado al alcance (búsqueda y paginación intactas). */
  listLeagues: async (
    req: FastifyRequest<{ Querystring: Record<string, any> }>,
    reply: FastifyReply,
  ) => {
    const query = { ...req.query };
    delete query.league;
    const result: any = await Leagues.smartQuery(query, {
      prePipeline: [{ $match: await getLeaguesScope(req) }],
      autoPaginate: true,
    });
    reply.send({
      page: result.pagination.page,
      total: result.pagination.total,
      data: result.data,
    });
  },
  /** GET /leagues/:id — 404 si la liga está fuera del alcance. */
  getLeague: async (
    req: FastifyRequest<{
      Params: { id: string };
      Querystring: Record<string, any>;
    }>,
    reply: FastifyReply,
  ) => {
    if (!isValidObjectId(req.params.id)) {
      throw new FastifyError("No se encontró el recurso", 404);
    }
    const query = { ...req.query };
    delete query.league;
    const [liga] = (await Leagues.smartQuery(query, {
      prePipeline: [
        {
          $match: {
            $and: [
              { _id: new Types.ObjectId(req.params.id) },
              await getLeaguesScope(req),
            ],
          },
        },
      ],
    })) as unknown as any[];
    if (!liga) throw new FastifyError("No se encontró el recurso", 404);
    reply.send(liga);
  },
  /** PUT /leagues/:id — solo ligas dentro del alcance. */
  updateLeague: async (
    req: FastifyRequest<{ Params: { id: string }; Body: Record<string, any> }>,
    reply: FastifyReply,
  ) => {
    if (!isValidObjectId(req.params.id)) {
      throw new FastifyError("No se encontró documento a editar", 404);
    }
    const liga = await Leagues.findOne({
      $and: [{ _id: req.params.id }, await getLeaguesScope(req)],
    });
    if (!liga) throw new FastifyError("No se encontró documento a editar", 404);
    const body = { ...(req.body ?? {}) };
    delete body._id;
    delete body.__v;
    delete body._movements;
    liga.set((deepmerge as any)(liga.toObject(), body));
    if (liga.isModified()) {
      liga._movements.push(
        await getMovimiento({ type: "edit", ...getUserIds(req) }),
      );
      await liga.save();
    }
    reply.send(liga);
  },
  getDashboard: async (req: FastifyRequest, reply: FastifyReply) => {
    debug("Dashborad de la liga", req.payload.league);
    const ligaExists = await Leagues.exists({
      _id: req.payload.league,
    });

    if (!ligaExists) {
      throw new FastifyError("No se encontró la liga");
    }

    const [campeonatos, categorias, equipos, partidos, jugadores, usuarios] =
      await Promise.all([
        Campeonatos.countDocuments({
          league: req.payload.league,
          status: "activo",
        }),
        Categorias.countDocuments({
          league: req.payload.league,
          status: "activo",
        }),
        Equipos.countDocuments({
          league: req.payload.league,
          status: "activo",
        }),
        Partidos.countDocuments({
          league: req.payload.league,
          status: "programado",
        }),
        Jugadores.countDocuments({
          league: req.payload.league,
          status: "activo",
        }),
        Users.countDocuments({
          leagues: req.payload.league,
          status: "activo",
          roles: { $ne: "master" },
        }),
      ]);

    reply.send({
      campeonatos,
      categorias,
      equipos,
      partidos,
      jugadores,
      usuarios,
    });
  },
};
