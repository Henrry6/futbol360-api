import mongoose from "mongoose";
import Debug from "debug";
import { FastifyError } from "@/libs/utils";
import Fixture from "@/modules/fixtures/service";
import Partidos from "@/modules/matchs/service";
import Campeonato from "@/modules/championships/championship.service";
import { FastifyReply, FastifyRequest } from "fastify";

const debug = Debug("src:modules:championships:championship.controller");

function shuffle<T>(array: T[]) {
  const arr = [...array];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

export default {
  generateFixture: async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    debug("Generar fixture", id);

    const campeonato = await Campeonato.findOne({
      _id: id,
      league: req.payload.league,
    }).lean();

    if (!campeonato) {
      throw new FastifyError("No se encontró el campeonato");
    }

    if (campeonato.competitionMode !== "round_robin") {
      throw new FastifyError("Modo de competencia no soportado");
    }

    const existeFixture = await Fixture.exists({
      championship: campeonato._id,
    });

    if (existeFixture) {
      throw new FastifyError("El fixture ya fue generado");
    }

    let teams = campeonato.teams.map((t) => t.team);

    if (teams.length < 2) {
      throw new FastifyError("Debe existir al menos dos equipos");
    }

    teams = shuffle(teams);

    const isOdd = teams.length % 2 === 1;

    if (isOdd) {
      teams.push(null as any);
    }

    const rounds = teams.length - 1;
    const matchesPerRound = teams.length / 2;
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      let rotation = [...teams];

      for (let round = 0; round < rounds; round++) {
        const fixture = await Fixture.create(
          [
            {
              league: req.payload.league,
              championship: campeonato._id,
              round: round + 1,
              name: `Jornada ${round + 1}`,
              status: "pendiente",
              matches: [],
            },
          ],
          { session },
        );

        const fixtureId = fixture[0]._id;

        const matchIds = [];

        for (let i = 0; i < matchesPerRound; i++) {
          const home = rotation[i];
          const away = rotation[rotation.length - 1 - i];

          if (!home || !away) continue;

          const [match] = await Partidos.create(
            [
              {
                league: req.payload.league,
                championship: campeonato._id,
                fixture: fixtureId,
                localTeam: round % 2 === 0 ? home : away,
                visitorTeam: round % 2 === 0 ? away : home,
                status: "programado",
              },
            ],
            { session },
          );

          matchIds.push(match._id);
        }

        await Fixture.updateOne(
          { _id: fixtureId },
          {
            $set: {
              matches: matchIds,
            },
          },
          { session },
        );

        // Rotación (Circle Method)
        rotation = [
          rotation[0],
          rotation[rotation.length - 1],
          ...rotation.slice(1, rotation.length - 1),
        ];
      }

      await session.commitTransaction();

      reply.send({
        message: "Fixture generado correctamente",
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },
};
