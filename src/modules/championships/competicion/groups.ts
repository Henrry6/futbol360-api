// groups.ts
// Fase de grupos: se reparten los equipos en grupos (A, B, C…) y cada grupo
// juega todos contra todos a una vuelta.
//
// Ejemplo: 16 equipos, 4 grupos → grupos de 4, 3 jornadas, 2 partidos por grupo
// en cada jornada (8 partidos por jornada, 24 en total).
//
// Cada jornada incluye los partidos de todos los grupos: así sigue valiendo la
// regla de que una jornada debe terminar antes de iniciar la siguiente.

import { ClientSession } from "mongoose";
import { FastifyError } from "@/libs/utils";
import {
  ChampionshipDocument,
  ChampionshipGroup,
  ChampionshipStage,
} from "@/models/champions";
import { calculateStandings } from "./standings";
import { rankAcrossGroups } from "./rankings";
import {
  createMatches,
  createRound,
  NewMatch,
  roundRobinSchedule,
  shuffle,
} from "./helpers";
import { Podium, Qualifiers, Seed } from "./types";

const GROUP_NAMES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function validate(stage: ChampionshipStage, participants: Seed[]) {
  const groups = stage.groups ?? 0;
  if (!stage.participants) {
    throw new FastifyError("Debe indicar la cantidad de participantes.");
  }
  if (participants.length !== stage.participants) {
    throw new FastifyError(
      `La etapa requiere ${stage.participants} equipos y hay ${participants.length} disponibles.`,
    );
  }
  if (groups < 2 || groups > GROUP_NAMES.length) {
    throw new FastifyError(
      `Indique entre 2 y ${GROUP_NAMES.length} grupos.`,
    );
  }
  const minGroupSize = Math.floor(participants.length / groups);
  if (minGroupSize < 2) {
    throw new FastifyError("Cada grupo necesita al menos 2 equipos.");
  }
  if (stage.qualifyTeams) {
    if (stage.qualifyTeams % groups !== 0) {
      throw new FastifyError(
        `Los clasificados (${stage.qualifyTeams}) deben repartirse en partes iguales entre ${groups} grupos.`,
      );
    }
    if (stage.qualifyTeams / groups >= minGroupSize) {
      throw new FastifyError(
        `Clasifican ${stage.qualifyTeams / groups} por grupo, pero hay grupos de ${minGroupSize} equipos.`,
      );
    }
  }
}

/**
 * Reparte los equipos en grupos en "serpentina" (1→A, 2→B, 3→C, 4→C, 5→B…).
 * - Etapa 1: el orden ya viene sorteado → reparto aleatorio y equilibrado.
 * - Desde otra etapa: vienen ordenados por rendimiento → los mejores quedan
 *   en grupos distintos (cabezas de serie).
 * Si no es división exacta, los primeros grupos quedan con un equipo más.
 */
export function drawGroups(seeds: Seed[], groups: number): ChampionshipGroup[] {
  const result: ChampionshipGroup[] = Array.from({ length: groups }, (_, i) => ({
    name: GROUP_NAMES[i],
    teams: [],
  }));
  seeds.forEach((seed, index) => {
    const lap = Math.floor(index / groups);
    const pos = index % groups;
    const groupIndex = lap % 2 === 0 ? pos : groups - 1 - pos;
    result[groupIndex].teams.push(seed.team);
  });
  // Con reparto no exacto la serpentina puede dejar más equipos al final:
  // ordenamos para que los grupos más grandes sean los primeros.
  return result
    .sort((a, b) => b.teams.length - a.teams.length)
    .map((group, i) => ({ ...group, name: GROUP_NAMES[i] }));
}

export async function generateFixture(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
  participants: Qualifiers,
  session: ClientSession,
) {
  const groups = drawGroups(participants.seeds, stage.groups!);
  // Se guarda la composición en la etapa (el servicio guarda el campeonato).
  stage.groupsTeams = groups;

  const schedules = groups.map((group) => ({
    name: group.name,
    rounds: roundRobinSchedule(shuffle(group.teams)),
  }));
  const totalRounds = Math.max(...schedules.map((s) => s.rounds.length));

  for (let r = 0; r < totalRounds; r++) {
    const round = await createRound(championship, stage, r + 1, session);
    const matches: NewMatch[] = schedules.flatMap((schedule) =>
      (schedule.rounds[r] ?? []).map(([localTeam, visitorTeam]) => ({
        localTeam,
        visitorTeam,
        group: schedule.name,
      })),
    );
    await createMatches(championship, stage, round._id, matches, session);
  }
}

/** Todas las jornadas se crean al generar el fixture: no hay rondas extra. */
export async function nextRound() {
  return false;
}

/**
 * Clasifican los primeros `qualifyTeams / groups` de cada grupo, ordenados
 * entre sí (todos los 1º, luego los 2º…) para sembrar la siguiente etapa.
 * Se envía el grupo de cada uno para evitar cruces del mismo grupo.
 */
export async function getQualifiers(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
): Promise<Qualifiers> {
  const groups = stage.groupsTeams?.length ?? stage.groups ?? 1;
  const perGroup = (stage.qualifyTeams ?? 0) / groups;
  const standings = await calculateStandings(championship, stage);
  const qualified = rankAcrossGroups(
    standings.filter((row) => row.position <= perGroup),
  );
  return {
    seeds: qualified.map((row) => ({
      team: row.team,
      group: row.group,
      groupPosition: row.position,
    })),
    ordering: "ranked",
  };
}

/**
 * Una fase de grupos no define un campeón único: si es la última etapa, el
 * campeonato termina sin campeón asignado. Agregue una etapa final (knockout
 * o liguilla) después de los grupos.
 */
export async function getPodium(): Promise<Podium> {
  return {};
}
