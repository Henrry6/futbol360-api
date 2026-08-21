import Debug from "debug";
import { Types } from "mongoose";
import { FastifyError } from "@/libs/utils";
import Round from "@/modules/rounds/service";
import { FastifyReply, FastifyRequest } from "fastify";
import Campeonato from "@/modules/championships/championship.service";

const debug = Debug("src:modules:championships:championship.controller");

export interface StageBody {
  // Nombre de la etapa.
  // Ejemplos:
  // "Fase Regular"
  // "Playoffs"
  // "Fase de Grupos"
  // "Eliminación Directa"
  name: string;

  // Modo de competencia utilizado para generar las jornadas y partidos.
  //
  // round_robin        -> Todos contra todos (una sola vuelta).
  // round_robin_double -> Todos contra todos (ida y vuelta).
  // groups             -> Fase de grupos.
  // knockout           -> Eliminación directa.
  mode: "round_robin" | "round_robin_double" | "groups" | "knockout";

  // Número de equipos que clasifican a la siguiente etapa.
  //
  // Ejemplos:
  // - Liga de 10 equipos donde avanzan los 6 mejores -> qualifyTeams = 6
  // - Mundial: clasifican 16 equipos -> qualifyTeams = 16
  //
  // No aplica para una etapa final del campeonato.
  qualifyTeams?: number;

  // Número de grupos que tendrá la etapa cuando el modo sea "groups".
  //
  // Ejemplos:
  // - Mundial -> groups = 8
  // - Copa con 16 equipos -> groups = 4
  //
  // Solo aplica cuando mode = "groups".
  groups?: number;

  // Indica si en la fase de eliminación directa se debe disputar
  // un partido por el tercer puesto.
  //
  // true  -> Se juega tercer y cuarto lugar.
  // false -> No existe partido por el tercer puesto.
  //
  // Solo aplica cuando mode = "knockout".
  thirdPlaceMatch?: boolean;
  // Número de equipos que participan en esta etapa.
  //
  // Ejemplos:
  //
  // Fase Regular
  // teams = 10
  //
  // Playoffs
  // teams = 6
  //
  // Final
  // teams = 2
  participants?: number;
}

export default {
  generateFixture: async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, stageId } = req.params as {
        id: string;
        stageId: string;
      };
      debug("Generar fixture", id);
      const campeonato = await Campeonato.findOne({
        _id: id,
        league: req.payload.league,
      });
      if (!campeonato) {
        throw new FastifyError("No se encontró el campeonato");
      }
      const etapa = await campeonato.getCurrentStage(
        new Types.ObjectId(stageId),
      );
      await campeonato.generateFixture(etapa);
      reply.send({
        message: "Fixture generado correctamente",
      });
    } catch (error) {
      throw error;
    }
  },
  deleteFixture: async (req: FastifyRequest, reply: FastifyReply) => {
    const { id, stageId } = req.params as {
      id: string;
      stageId: string;
    };
    const campeonato = await Campeonato.findOne({
      _id: id,
      league: req.payload.league,
    });
    if (!campeonato) {
      throw new FastifyError("No se encontró el campeonato");
    }
    await campeonato.deleteFixture(stageId);
    reply.send({
      message: "Fixture eliminado correctamente",
    });
  },
  tablePositions: async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { stageId } = req.query as { stageId?: string };
    const championship = await Campeonato.findOne({
      _id: id,
      league: req.payload.league,
    });
    if (!championship) {
      throw new FastifyError("No se encontró el campeonato.");
    }
    const standings = await championship.tablePositions(stageId as any);
    reply.send(standings);
  },
  createStage: async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as StageBody;
    const championship = await Campeonato.findOne({
      _id: id,
      league: req.payload.league,
    });
    if (!championship) {
      throw new FastifyError("No se encontró el campeonato");
    }
    championship.stages.push({
      order: championship.stages.length + 1,
      status: "pendiente",
      ...body,
    });

    await championship.save();
    reply.send({
      message: "Etapa creada correctamente",
    });
  },
  getStages: async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const championship = await Campeonato.findOne(
      {
        _id: id,
        league: req.payload.league,
      },
      {
        stages: 1,
      },
    ).lean();

    if (!championship) {
      throw new FastifyError("No se encontró el campeonato");
    }
    reply.send(championship.stages);
  },
  updateStage: async (req: FastifyRequest, reply: FastifyReply) => {
    const { id, stageId } = req.params as {
      id: string;
      stageId: string;
    };

    const body = req.body as Partial<StageBody>;
    const championship = await Campeonato.findOne({
      _id: id,
      league: req.payload.league,
    });
    if (!championship) {
      throw new FastifyError("No se encontró el campeonato");
    }
    const stage = championship.stages.id(stageId);
    if (!stage) {
      throw new FastifyError("No se encontró la etapa");
    }
    Object.assign(stage, body);
    await championship.save();

    reply.send({
      message: "Etapa actualizada correctamente",
    });
  },
  deleteStage: async (req: FastifyRequest, reply: FastifyReply) => {
    const { id, stageId } = req.params as {
      id: string;
      stageId: string;
    };

    const championship = await Campeonato.findOne({
      _id: id,
      league: req.payload.league,
    });
    if (!championship) {
      throw new FastifyError("No se encontró el campeonato");
    }
    const stage = championship.stages.id(stageId);
    if (!stage) {
      throw new FastifyError("No se encontró la etapa");
    }
    const existsRounds = await Round.exists({
      championship: championship._id,
      stage: stage._id,
    });

    if (existsRounds) {
      throw new FastifyError("La etapa ya tiene jornadas generadas");
    }
    if (stage.status !== "pendiente") {
      throw new FastifyError("Solo se pueden eliminar etapas pendientes");
    }

    stage.deleteOne();
    championship.stages.forEach((stage, index) => {
      stage.order = index + 1;
    });
    await championship.save();

    reply.send({
      message: "Etapa eliminada correctamente",
    });
  },
};
