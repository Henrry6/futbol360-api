// knockout.ts
// Eliminación directa a partido único.
//
// Una etapa knockout se juega ronda por ronda: al generar el fixture se crea
// solo la primera ronda; cuando termina, `nextRound` crea la siguiente con los
// ganadores (lo dispara automáticamente el cierre de la última vocalía).
//
// Ejemplo: 8 equipos → Cuartos de final (4) → Semifinal (2) → Final (1)
//          [+ tercer lugar en la misma jornada de la final si thirdPlaceMatch].
//
// Con `qualifyTeams` la etapa se detiene antes de la final:
//   participants 8, qualifyTeams 4 → solo cuartos; los 4 ganadores pasan a la
//   siguiente etapa (por ejemplo otra etapa knockout "Semifinales").
//
// Empates: si un partido termina empatado se define por penales
// (`localPenalties` / `visitorPenalties`, se envían al finalizar la vocalía).

import { ClientSession, Types } from "mongoose";
import { FastifyError } from "@/libs/utils";
import Partidos from "@/modules/matchs/service";
import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";
import { createBracket, isPowerOfTwo, knockoutRoundName } from "./brackets";
import {
  createMatches,
  createRound,
  getKnockoutResult,
  getStageRounds,
  NewMatch,
} from "./helpers";
import { Podium, Qualifiers, Seed } from "./types";

/** Equipos con los que termina la etapa: 1 (campeón) o `qualifyTeams`. */
function stageTarget(stage: ChampionshipStage) {
  return stage.qualifyTeams || 1;
}

export function validate(stage: ChampionshipStage, participants: Seed[]) {
  if (!stage.participants) {
    throw new FastifyError("Debe indicar los participantes.");
  }
  if (!isPowerOfTwo(stage.participants)) {
    throw new FastifyError(
      "Una eliminación directa requiere 2, 4, 8, 16, 32... participantes.",
    );
  }
  if (participants.length !== stage.participants) {
    throw new FastifyError(
      `La etapa requiere ${stage.participants} equipos y hay ${participants.length} disponibles.`,
    );
  }
  // qualifyTeams 1 (o vacío) = se juega hasta la final y sale un campeón
  if (stage.qualifyTeams && stage.qualifyTeams > 1) {
    if (
      !isPowerOfTwo(stage.qualifyTeams) ||
      stage.qualifyTeams >= stage.participants
    ) {
      throw new FastifyError(
        "En eliminación directa los clasificados deben ser potencia de 2 y menos que los participantes (ej.: 8 → 4).",
      );
    }
    if (stage.thirdPlaceMatch) {
      throw new FastifyError(
        "El partido por el tercer lugar solo aplica si la etapa se juega hasta la final (sin clasificados).",
      );
    }
  }
}

/** Crea la primera ronda de la llave. */
export async function generateFixture(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
  participants: Qualifiers,
  session: ClientSession,
) {
  const pairs = createBracket(participants.seeds, participants.ordering);
  const round = await createRound(
    championship,
    stage,
    1,
    session,
    knockoutRoundName(participants.seeds.length),
  );
  await createMatches(
    championship,
    stage,
    round._id,
    pairs.map((pair) => ({
      localTeam: pair.local.team,
      visitorTeam: pair.visitor.team,
      bracketPosition: pair.position,
    })),
    session,
  );
}

/**
 * Partidos de una ronda en orden de llave, con nombres de equipos y de la
 * jornada poblados para que los errores digan "España 1 - 1 Juventus (Final)".
 */
function getRoundMatches(
  roundId: unknown,
  { includeThirdPlace = false, session }: { includeThirdPlace?: boolean; session?: ClientSession } = {},
) {
  return Partidos.find({
    round: roundId,
    ...(includeThirdPlace ? {} : { isThirdPlaceMatch: { $ne: true } }),
  })
    .sort({ bracketPosition: 1, _id: 1 })
    .populate<{ localTeam: { _id: Types.ObjectId; name: string } }>("localTeam", "name")
    .populate<{ visitorTeam: { _id: Types.ObjectId; name: string } }>("visitorTeam", "name")
    .populate<{ round: { _id: Types.ObjectId; name: string } }>("round", "name")
    .session(session ?? null)
    .lean();
}

/**
 * Crea la siguiente ronda con los ganadores de la última:
 * ganador cruce 1 vs ganador cruce 2, ganador 3 vs ganador 4…
 * Antes de la final, si `thirdPlaceMatch`, también crea el partido entre los
 * perdedores de semifinal. Devuelve false si la etapa ya terminó.
 */
export async function nextRound(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
  session: ClientSession,
): Promise<boolean> {
  const rounds = await getStageRounds(championship, stage, session);
  const last = rounds.at(-1);
  if (!last || last.status !== "finalizado") return false;

  const matches = await getRoundMatches(last._id, { session });
  const results = matches.map(getKnockoutResult);
  const winners = results.map((r) => r.winner);

  if (winners.length <= stageTarget(stage)) return false;

  const newMatches: NewMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    newMatches.push({
      localTeam: winners[i],
      visitorTeam: winners[i + 1],
      bracketPosition: i / 2 + 1,
    });
  }
  const isFinal = winners.length === 2;
  if (isFinal && stage.thirdPlaceMatch) {
    newMatches.push({
      localTeam: results[0].loser,
      visitorTeam: results[1].loser,
      bracketPosition: 2,
      isThirdPlaceMatch: true,
    });
  }

  const name = knockoutRoundName(winners.length);
  const round = await createRound(
    championship,
    stage,
    last.round + 1,
    session,
    isFinal && stage.thirdPlaceMatch ? `${name} y tercer lugar` : name,
  );
  await createMatches(championship, stage, round._id, newMatches, session);
  return true;
}

/** Ganadores de la última ronda, en orden de llave, para la siguiente etapa. */
export async function getQualifiers(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
): Promise<Qualifiers> {
  const rounds = await getStageRounds(championship, stage);
  const last = rounds.at(-1);
  const matches = last ? await getRoundMatches(last._id) : [];
  const winners = matches.map((m) => getKnockoutResult(m).winner);
  if (winners.length !== stage.qualifyTeams) {
    throw new FastifyError(
      `La etapa ${stage.name} aún no define sus ${stage.qualifyTeams ?? 0} clasificados.`,
    );
  }
  return {
    seeds: winners.map((team) => ({ team })),
    ordering: "bracket",
  };
}

/** Campeón y subcampeón salen de la final; tercero del partido por el 3er lugar. */
export async function getPodium(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
): Promise<Podium> {
  if (stageTarget(stage) > 1) return {};
  const rounds = await getStageRounds(championship, stage);
  const last = rounds.at(-1);
  if (!last) return {};

  const lastMatches = await getRoundMatches(last._id, {
    includeThirdPlace: true,
  });
  const final = lastMatches.filter((m) => !m.isThirdPlaceMatch);
  if (final.length !== 1) return {};

  const { winner, loser } = getKnockoutResult(final[0]);
  const thirdMatch = lastMatches.find((m) => m.isThirdPlaceMatch);
  return {
    champion: winner,
    runnerUp: loser,
    thirdPlace: thirdMatch ? getKnockoutResult(thirdMatch).winner : undefined,
  };
}
