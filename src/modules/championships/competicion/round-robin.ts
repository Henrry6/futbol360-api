// round-robin.ts

import mongoose, { Types } from "mongoose";
import Fixture from "@/modules/fixtures/service";
import Partidos from "@/modules/matchs/service";

import { ChampionshipDocument } from "@/models/champions";

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

function validateChampionship(championship: ChampionshipDocument) {
  if (championship.teams.length < 2) {
    throw new Error("Debe existir al menos dos equipos");
  }
}

async function createFixture(
  championship: ChampionshipDocument,
  round: number,
  session: mongoose.ClientSession,
) {
  const [fixture] = await Fixture.create(
    [
      {
        league: championship.league,
        championship: championship._id,
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
  fixtureId: any,
  rotation: (any | null)[],
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
          fixture: fixtureId,
          localTeam: round % 2 === 0 ? home : away,
          visitorTeam: round % 2 === 0 ? away : home,
          status: "programado",
        },
      ],
      { session },
    );
  }
}

function prepareTeams(
  championship: ChampionshipDocument,
): (Types.ObjectId | null)[] {
  const teams: (Types.ObjectId | null)[] = championship.teams.map(
    (t) => t.team,
  );
  const shuffledTeams = shuffle(teams);
  if (shuffledTeams.length % 2 !== 0) {
    shuffledTeams.push(null);
  }

  return shuffledTeams;
}

export async function generateFixture(championship: ChampionshipDocument) {
  validateChampionship(championship);

  let teams = prepareTeams(championship);

  const rounds = teams.length - 1;
  const matchesPerRound = teams.length / 2;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    let rotation = [...teams];

    for (let round = 0; round < rounds; round++) {
      const fixture = await createFixture(championship, round, session);

      await createMatches(
        championship,
        fixture._id,
        rotation,
        round,
        matchesPerRound,
        session,
      );

      rotation = rotate(rotation);
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function calculateStandings() {}

export async function finishChampionship() {}
