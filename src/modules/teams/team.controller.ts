import Debug from "debug";
import { FastifyError } from "@/libs/utils";
import Equipos from "@/modules/teams/team.service";
import Jugadores from "@/modules/players/player.service";
import { FastifyReply, FastifyRequest } from "fastify";
import { buildImageUrl, deleteImage, uploadImage } from "@/libs/cloudinary";

const debug = Debug("src:modules:teams:team.controller");

export default {
  getPlayersGroups: async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    debug("Obtener jugadores del equipo", id);

    const equipoExist = await Equipos.exists({
      _id: id,
      league: req.payload.league,
    });

    if (!equipoExist) {
      throw new FastifyError("No se encontró el equipo");
    }

    const jugadores = await Jugadores.find(
      {
        team: id,
        league: req.payload.league,
      },
      {
        photo: 1,
        jerseyNumber: 1,
        names: 1,
        lastName: 1,
        position: 1,
        status: 1,
      },
    ).sort({
      jerseyNumber: 1,
    });

    const labels: Record<string, string> = {
      portero: "Porteros",
      defensa: "Defensas",
      lateral_derecho: "Laterales derechos",
      lateral_izquierdo: "Laterales izquierdos",
      volante: "Volantes",
      mediocampista: "Mediocampistas",
      extremo_derecho: "Extremos derechos",
      extremo_izquierdo: "Extremos izquierdos",
      delantero: "Delanteros",
    };

    const groups = new Map<
      string,
      {
        position: string;
        players: typeof jugadores;
      }
    >();

    for (const jugador of jugadores) {
      const position = labels[jugador.position ?? ""] ?? "Sin posición";

      if (!groups.has(position)) {
        groups.set(position, {
          position,
          players: [],
        });
      }

      groups.get(position)!.players.push(jugador);
    }

    reply.send([...groups.values()]);
  },

  uploadImage: async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    const team = await Equipos.findOne({ _id: id, league: req.payload.league });
    if (!team) {
      throw new FastifyError("No se encontró el equipo");
    }
    const file = await req.file();
    if (!file) {
      throw new FastifyError("No se envió ningún archivo", 400);
    }
    const buffer = await file.toBuffer();

    if (team.logo) {
      await deleteImage(team.logo);
    }

    const result = await uploadImage(buffer, "futbol360/teams");
    team.logo = result.publicId;
    await team.save();

    reply.send({ publicId: team.logo, url: buildImageUrl(team.logo) });
  },

  getImage: async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    const team = await Equipos.findOne(
      { _id: id, league: req.payload.league },
      { logo: 1 },
    ).lean();
    if (!team) {
      throw new FastifyError("No se encontró el equipo");
    }
    reply.send({ publicId: team.logo, url: buildImageUrl(team.logo) });
  },

  deleteImage: async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    const team = await Equipos.findOne({ _id: id, league: req.payload.league });
    if (!team) {
      throw new FastifyError("No se encontró el equipo");
    }
    if (team.logo) {
      await deleteImage(team.logo);
      team.logo = undefined;
      await team.save();
    }
    reply.send({ success: true });
  },
};
