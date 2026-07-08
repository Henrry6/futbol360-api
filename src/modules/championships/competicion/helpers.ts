import mongoose, { Types } from "mongoose";
import Round from "@/modules/rounds/service";
import Partidos from "@/modules/matchs/service";
import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function rotate<T>(rotation: T[]): T[] {
  return [
    rotation[0],
    rotation[rotation.length - 1],
    ...rotation.slice(1, rotation.length - 1),
  ];
}

export async function createRound(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
  roundNumber: number,
  session: mongoose.ClientSession,
) {
  const [round] = await Round.create(
    [
      {
        league: championship.league,
        championship: championship._id,
        stage: stage._id,
        round: roundNumber,
        name: `Jornada ${roundNumber}`,
        status: "pendiente",
      },
    ],
    { session },
  );

  return round;
}

export async function createMatches(
  championship: ChampionshipDocument,
  round: Types.ObjectId,
  stage: ChampionshipStage,
  rotation: (Types.ObjectId | null)[],
  matchesPerRound: number,
  /**
   * Indica si debe invertirse la localía de cada enfrentamiento.
   * - false: Ida (A vs B)
   * - true : Vuelta (B vs A)
   */
  swapHomeAway: boolean,
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
          round,
          stage: stage._id,
          localTeam: swapHomeAway ? away : home,
          visitorTeam: swapHomeAway ? home : away,
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
export function prepareTeams(
  teams: Types.ObjectId[],
): (Types.ObjectId | null)[] {
  const shuffled: (Types.ObjectId | null)[] = shuffle([...teams]);
  if (shuffled.length % 2 !== 0) {
    shuffled.push(null);
  }
  return shuffled;
}
