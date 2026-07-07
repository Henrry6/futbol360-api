// round-robin.ts
// Generar jornadas todos contra todos
import mongoose, { Types } from "mongoose";
import Round from "@/modules/rounds/service";
import Partidos from "@/modules/matchs/service";
import { getStageParticipants } from "./particpants";
import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function rotate<T>(rotation: T[]): T[] {
  return [
    rotation[0],
    rotation[rotation.length - 1],
    ...rotation.slice(1, rotation.length - 1),
  ];
}

function validateStage(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
) {
  if (!stage.participants) {
    throw new Error("Debe indicar la cantidad de participantes.");
  }
  if (championship.teams.length < 2) {
    throw new Error("Debe existir al menos dos equipos");
  }

  if (stage.participants && championship.teams.length !== stage.participants) {
    throw new Error(`La etapa requiere ${stage.participants} equipos.`);
  }
  if (stage.qualifyTeams && stage.qualifyTeams >= stage.participants) {
    throw new Error(
      "Los clasificados deben ser menores que los participantes.",
    );
  }

  if (stage.status !== "pendiente") {
    throw new Error("La etapa ya fue generada.");
  }
}

async function createRound(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
  round: number,
  session: mongoose.ClientSession,
) {
  const [fixture] = await Round.create(
    [
      {
        league: championship.league,
        championship: championship._id,
        stage: stage._id,
        round: round + 1,
        name: `Jornada ${round + 1}`,
        status: "pendiente",
      },
    ],
    { session },
  );

  return fixture;
}

async function createMatches(
  championship: ChampionshipDocument,
  idRound: any,
  stage: ChampionshipStage,
  rotation: (Types.ObjectId | null)[],
  round: number,
  matchesPerRound: number,
  session: mongoose.ClientSession,
) {
  for (let i = 0; i < matchesPerRound; i++) {
    const home = rotation[i];
    const away = rotation[rotation.length - 1 - i];

    if (!home || !away) continue;

    await Partidos.create(
      [
        {
          league: championship.league,
          championship: championship._id,
          round: idRound,
          stage: stage._id,
          localTeam: round % 2 === 0 ? home : away,
          visitorTeam: round % 2 === 0 ? away : home,
          status: "programado",
        },
      ],
      { session },
    );
  }
}
/**
 * Prepara un arreglo de equipos para generar el fixture, mezclando los equipos
 * y agregando un equipo nulo si es necesario.
 *  */
function prepareTeams(teams: Types.ObjectId[]): (Types.ObjectId | null)[] {
  const shuffled: (Types.ObjectId | null)[] = shuffle([...teams]);
  if (shuffled.length % 2 !== 0) {
    shuffled.push(null);
  }
  return shuffled;
}

export async function generateFixture(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
) {
  validateStage(championship, stage);
  const participants = await getStageParticipants(championship, stage);
  console.log(participants, "PARTICIPANTES");
  const teams = prepareTeams(participants);
  const rounds = teams.length - 1;
  const matchesPerRound = teams.length / 2;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    let rotation = [...teams];

    for (let round = 0; round < rounds; round++) {
      const ronda = await createRound(championship, stage, round, session);

      await createMatches(
        championship,
        ronda._id,
        stage,
        rotation,
        round,
        matchesPerRound,
        session,
      );

      rotation = rotate(rotation);
    }
    stage.status = "generada";
    await championship.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
