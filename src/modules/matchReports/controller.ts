import Vocalias from "./matchReport.service";
import Partidos from "@/modules/matchs/service";
import { FastifyReply, FastifyRequest } from "fastify";
import { deepmerge, FastifyError, getMovimiento } from "@/libs/utils";

export const actualizarVocalia = async (
  request: FastifyRequest<{
    Params: { id: string };
    Body: Record<string, any>;
  }>,
  reply: FastifyReply,
) => {
  const { id } = request.params;

  const vocalia = await Vocalias.findById(id);
  if (!vocalia) {
    throw new FastifyError("No se encontró la vocalía a editar", 404);
  }

  vocalia.$locals.docOriginal = vocalia.toObject();

  const original = vocalia.toObject() as Record<string, any>;
  const cambios = request.body as Record<string, any>;

  vocalia.set((deepmerge as any)(original, cambios));
  if (vocalia.isModified()) {
    await vocalia.save();
  }

  return reply.send(vocalia);
};
export default {
  endReportMatch: async (
    req: FastifyRequest<{
      Params: {
        id: string;
      };
      Body: {
        status: "finalizado" | "suspendido";
      };
    }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    const { status } = req.body;
    const vocalia = await Vocalias.findById(id);
    if (!vocalia) {
      throw new FastifyError("Vocalia no encontradoA");
    }
    if (!req.body.status) {
      throw new FastifyError("Indique el estado de la vocalía.");
    }
    if (vocalia.status === "finalizada") {
      throw new FastifyError("La vocalía ya fue finalizada.");
    }
    if (!vocalia.endTime) {
      vocalia.endTime = new Date();
    }
    vocalia.status = "finalizada";
    const movimiento = await getMovimiento({
      user: req.payload.user,
      type: status,
    });
    vocalia._movements.push(movimiento);
    await vocalia.save();

    await Partidos.updateOne(
      { _id: vocalia.match },
      {
        $set: { status },
        $push: { _movements: movimiento },
      },
    );
    reply.send("Vocalia finalizada");
  },
  actualizarVocalia,
};
