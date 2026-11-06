import { FastifyError } from "@/libs/utils";
import { FastifyReply, FastifyRequest } from "fastify";
import Jugadores from "@/modules/players/player.service";
import { uploadImage, deleteImage, buildImageUrl } from "@/libs/cloudinary";

export default {
  uploadImage: async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    const player = await Jugadores.findOne({
      _id: id,
      league: req.payload.league,
    });
    if (!player) {
      throw new FastifyError("No se encontró el jugador");
    }
    const file = await req.file();
    if (!file) {
      throw new FastifyError("No se envió ningún archivo", 400);
    }
    const buffer = await file.toBuffer();

    if (player.photo) {
      await deleteImage(player.photo);
    }

    const result = await uploadImage(buffer, "futbol360/players");
    player.photo = result.publicId;
    await player.save();

    reply.send({ publicId: player.photo, url: buildImageUrl(player.photo) });
  },

  getImage: async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    const player = await Jugadores.findOne(
      { _id: id, league: req.payload.league },
      { photo: 1 },
    ).lean();
    if (!player) {
      throw new FastifyError("No se encontró el jugador");
    }
    reply.send({ publicId: player.photo, url: buildImageUrl(player.photo) });
  },

  deleteImage: async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    const player = await Jugadores.findOne({
      _id: id,
      league: req.payload.league,
    });
    if (!player) {
      throw new FastifyError("No se encontró el jugador");
    }
    if (player.photo) {
      await deleteImage(player.photo);
      player.photo = undefined;
      await player.save();
    }
    reply.send({ success: true });
  },
};
