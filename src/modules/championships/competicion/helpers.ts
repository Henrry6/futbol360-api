import { ClientSession, Types } from "mongoose";
import Round from "@/modules/rounds/service";
import Partidos from "@/modules/matchs/service";
import { FastifyError } from "@/libs/utils";
import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Calendario todos contra todos (una vuelta) con el método del círculo.
 * Función pura: no toca la base de datos.
 *
 * - n equipos (par)  → n-1 jornadas de n/2 partidos.
 * - n equipos (impar) → se agrega un "descanso" (null): n jornadas y en cada una
 *   descansa un equipo (su partido contra null no se crea).
 *
 * Cada jornada se arma emparejando posiciones opuestas del círculo
 * (0 con n-1, 1 con n-2…). Luego se fija la posición 0 y el resto rota.
 *
 * Localía: se reparte para que nadie juegue siempre de local o de visitante
 * (antes el equipo fijo del círculo era local en todas sus fechas).
 *
 * Devuelve: jornadas → partidos [local, visitante].
 */
export function roundRobinSchedule<T>(teams: T[]): [T, T][][] {
  const circle: (T | null)[] = [...teams];
  if (circle.length % 2 !== 0) circle.push(null);

  const n = circle.length;
  const rounds: [T, T][][] = [];
  let rotation = circle;

  for (let r = 0; r < n - 1; r++) {
    const matches: [T, T][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (a === null || b === null) continue; // descanso
      // Localía: el equipo fijo (posición 0) alterna por jornada; el resto
      // alterna por posición. Verificado para 3–20 equipos: con n par cada
      // equipo es local la mitad de las fechas (±1) y nunca más de 2 seguidas;
      // con n impar, máximo 3 seguidas.
      const swap = i === 0 ? r % 2 === 1 : i % 2 === 1;
      matches.push(swap ? [b, a] : [a, b]);
    }
    rounds.push(matches);
    rotation = [rotation[0], rotation[n - 1], ...rotation.slice(1, n - 1)];
  }

  return rounds;
}

/**
 * Agrega la vuelta: repite las jornadas de ida con la localía invertida.
 */
export function withReturnLeg<T>(firstLeg: [T, T][][]): [T, T][][] {
  return [
    ...firstLeg,
    ...firstLeg.map((round) =>
      round.map(([home, away]) => [away, home] as [T, T]),
    ),
  ];
}

export async function createRound(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
  roundNumber: number,
  session: ClientSession,
  name?: string,
) {
  const [round] = await Round.create(
    [
      {
        league: championship.league,
        championship: championship._id,
        stage: stage._id,
        round: roundNumber,
        name: name ?? `Jornada ${roundNumber}`,
        status: "pendiente",
      },
    ],
    { session },
  );

  return round;
}

export interface NewMatch {
  localTeam: Types.ObjectId;
  visitorTeam: Types.ObjectId;
  group?: string;
  bracketPosition?: number;
  isThirdPlaceMatch?: boolean;
}

/** Crea los partidos de una jornada (todos en estado "programado"). */
export async function createMatches(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
  round: Types.ObjectId,
  matches: NewMatch[],
  session: ClientSession,
) {
  if (matches.length === 0) return;
  await Partidos.insertMany(
    matches.map((match) => ({
      league: championship.league,
      championship: championship._id,
      stage: stage._id,
      round,
      status: "programado",
      ...match,
    })),
    { session },
  );
}

/** Jornadas de una etapa ordenadas por número. */
export function getStageRounds(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
  session?: ClientSession,
) {
  return Round.find({ championship: championship._id, stage: stage._id })
    .sort({ round: 1 })
    .session(session ?? null);
}

/** Equipo o jornada que puede venir como id o poblado ({ _id, name }). */
type Ref = Types.ObjectId | { _id: Types.ObjectId; name?: string };

export interface KnockoutMatch {
  _id: Types.ObjectId;
  status: string;
  localTeam: Ref;
  visitorTeam: Ref;
  round?: Ref;
  localGoals?: number;
  visitorGoals?: number;
  localPenalties?: number | null;
  visitorPenalties?: number | null;
}

const refId = (ref: Ref): Types.ObjectId =>
  ref instanceof Types.ObjectId ? ref : ref._id;
const refName = (ref: Ref | undefined, fallback: string) =>
  ref && !(ref instanceof Types.ObjectId) && ref.name ? ref.name : fallback;

/**
 * Descripción legible de un partido para mensajes de error, p. ej.
 * "España 1 - 1 Juventus (Semifinal)". Para ver nombres, quien llama debe
 * poblar `localTeam`, `visitorTeam` y `round` con `name` (ver knockout.ts).
 */
export function describeMatch(match: KnockoutMatch) {
  const local = refName(match.localTeam, "Local");
  const visitor = refName(match.visitorTeam, "Visitante");
  const round = refName(match.round, "");
  return `${local} ${match.localGoals ?? 0} - ${match.visitorGoals ?? 0} ${visitor}${round ? ` (${round})` : ""}`;
}

/**
 * Ganador y perdedor de un partido de eliminación directa.
 * Gana quien hizo más goles; si empatan, decide la tanda de penales.
 * Lanza error si el partido no terminó o terminó empatado sin penales.
 * Devuelve siempre ids (aunque los equipos vengan poblados).
 */
export function getKnockoutResult(match: KnockoutMatch) {
  if (!["finalizado", "suspendido"].includes(match.status)) {
    throw new FastifyError(
      `El partido ${describeMatch(match)} aún no ha terminado.`,
    );
  }
  const local = match.localGoals ?? 0;
  const visitor = match.visitorGoals ?? 0;
  let localWins: boolean;
  if (local !== visitor) {
    localWins = local > visitor;
  } else {
    const lp = match.localPenalties;
    const vp = match.visitorPenalties;
    if (lp === undefined || vp === undefined || lp === null || vp === null || lp === vp) {
      throw new FastifyError(
        `El partido ${describeMatch(match)} terminó empatado y no tiene un ganador por penales. ` +
          `Registre los penales del partido (localPenalties / visitorPenalties) y vuelva a intentarlo. ` +
          `[id ${match._id}]`,
      );
    }
    localWins = lp > vp;
  }
  const localTeam = refId(match.localTeam);
  const visitorTeam = refId(match.visitorTeam);
  return localWins
    ? { winner: localTeam, loser: visitorTeam }
    : { winner: visitorTeam, loser: localTeam };
}
