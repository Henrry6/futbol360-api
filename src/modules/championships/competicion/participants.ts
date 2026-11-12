// participants.ts
// Define qué equipos juegan una etapa.

import { FastifyError } from "@/libs/utils";
import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";
import { getCompetition } from "./index";
import { shuffle } from "./helpers";
import { Qualifiers } from "./types";

/**
 * - Etapa 1: los equipos inscritos con estado "activo", en orden aleatorio
 *   (sorteo).
 * - Etapas siguientes: los clasificados de la etapa anterior, que debe estar
 *   finalizada y declarar `qualifyTeams` igual a los `participants` de esta.
 */
export async function getStageParticipants(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
): Promise<Qualifiers> {
  if (stage.order === 1) {
    const teams = championship.teams
      .filter((t) => t.status === "activo")
      .map((t) => ({ team: t.team }));
    return { seeds: shuffle(teams), ordering: "ranked" };
  }

  const previous = championship.stages.find((s) => s.order === stage.order - 1);
  if (!previous) {
    throw new FastifyError("No existe una etapa anterior.");
  }
  if (previous.status !== "finalizada") {
    throw new FastifyError(
      `La etapa anterior (${previous.name}) aún no ha finalizado.`,
    );
  }
  if (!previous.qualifyTeams) {
    throw new FastifyError(
      `La etapa anterior (${previous.name}) no define clasificados.`,
    );
  }
  if (previous.qualifyTeams !== stage.participants) {
    throw new FastifyError(
      `La etapa ${stage.name} espera ${stage.participants ?? 0} participantes, pero de ${previous.name} clasifican ${previous.qualifyTeams}.`,
    );
  }

  return getCompetition(previous.mode).getQualifiers(championship, previous);
}
