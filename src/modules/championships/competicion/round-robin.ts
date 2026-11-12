// round-robin.ts
// Liga: todos contra todos a una vuelta. También lo usa round-robin-double.ts.
//
// Ejemplo: 10 equipos → 9 jornadas de 5 partidos = 45 partidos.
//          9 equipos  → 9 jornadas de 4 partidos (un equipo descansa por jornada).

import { ClientSession } from "mongoose";
import { FastifyError } from "@/libs/utils";
import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";
import { calculateStandings } from "./standings";
import {
  createMatches,
  createRound,
  roundRobinSchedule,
  shuffle,
  withReturnLeg,
} from "./helpers";
import { Podium, Qualifiers, Seed } from "./types";

export function validate(stage: ChampionshipStage, participants: Seed[]) {
  if (!stage.participants) {
    throw new FastifyError("Debe indicar la cantidad de participantes.");
  }
  if (participants.length !== stage.participants) {
    throw new FastifyError(
      `La etapa requiere ${stage.participants} equipos y hay ${participants.length} disponibles.`,
    );
  }
  if (participants.length < 2) {
    throw new FastifyError("Debe existir al menos dos equipos.");
  }
  if (stage.qualifyTeams && stage.qualifyTeams >= stage.participants) {
    throw new FastifyError(
      "Los clasificados deben ser menos que los participantes.",
    );
  }
}

export async function generateRoundRobin(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
  participants: Qualifiers,
  session: ClientSession,
  legs: 1 | 2,
) {
  // El orden del círculo define el calendario: se sortea siempre.
  const teams = shuffle(participants.seeds.map((s) => s.team));
  const firstLeg = roundRobinSchedule(teams);
  const schedule = legs === 2 ? withReturnLeg(firstLeg) : firstLeg;

  for (const [index, matches] of schedule.entries()) {
    const round = await createRound(championship, stage, index + 1, session);
    await createMatches(
      championship,
      stage,
      round._id,
      matches.map(([localTeam, visitorTeam]) => ({ localTeam, visitorTeam })),
      session,
    );
  }
}

export function generateFixture(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
  participants: Qualifiers,
  session: ClientSession,
) {
  return generateRoundRobin(championship, stage, participants, session, 1);
}

/** Todas las jornadas se crean al generar el fixture: no hay rondas extra. */
export async function nextRound() {
  return false;
}

/** Clasifican los primeros `qualifyTeams` de la tabla, en orden de posición. */
export async function getQualifiers(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
): Promise<Qualifiers> {
  const standings = await calculateStandings(championship, stage);
  return {
    seeds: standings
      .slice(0, stage.qualifyTeams ?? 0)
      .map((row) => ({ team: row.team })),
    ordering: "ranked",
  };
}

/** Si la liga es la última etapa: 1º campeón, 2º subcampeón, 3º tercero. */
export async function getPodium(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
): Promise<Podium> {
  const [first, second, third] = await calculateStandings(championship, stage);
  return {
    champion: first?.team,
    runnerUp: second?.team,
    thirdPlace: third?.team,
  };
}
