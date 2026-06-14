import Debug from "debug";
import Users from "../users/users.service";
import { FastifyError } from "@/libs/utils";
import Equipos from "@/modules/teams/team.service";
import { FastifyReply, FastifyRequest } from "fastify";
import Leagues from "@/modules/leagues/leagues.service";
import Jugadores from "@/modules/players/player.service";
import Categorias from "@/modules/categories/category.service";
import Campeonatos from "@/modules/championships/champioship.service";

const debug = Debug("src:modules:leagues:leagues.controller");

export default {
  getDashboard: async (req: FastifyRequest, reply: FastifyReply) => {
    debug("Dashborad de la liga", req.payload.league);
    const ligaExists = await Leagues.exists({
      _id: req.payload.league,
    });

    if (!ligaExists) {
      throw new FastifyError("No se encontró la liga");
    }

    const [campeonatos, categorias, equipos, jugadores, usuarios] =
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
        Jugadores.countDocuments({
          league: req.payload.league,
          status: "activo",
        }),
        Users.countDocuments({
          leagues: req.payload.league,
          status: "activo",
          role: { $ne: "master" },
        }),
      ]);

    reply.send({
      campeonatos,
      categorias,
      equipos,
      jugadores,
      usuarios,
    });
  },
};
