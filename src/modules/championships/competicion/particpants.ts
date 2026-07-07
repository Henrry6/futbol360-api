// Obtener quién juega esta etapa
import { Types } from "mongoose";
import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";

import { calculateStandings } from "./standings";

function validateStageSequence(
  previousStage: ChampionshipStage,
  currentStage: ChampionshipStage,
) {
  if (!previousStage.qualifyTeams) {
    throw new Error("La etapa anterior no define clasificados.");
  }

  if (previousStage.qualifyTeams !== currentStage.participants) {
    throw new Error(
      "Los participantes de la etapa no coinciden con los clasificados de la etapa anterior.",
    );
  }
}
export async function getStageParticipants(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
): Promise<Types.ObjectId[]> {
  // Primera etapa:
  // toma los equipos inscritos en el campeonato
  if (stage.order === 1) {
    return championship.teams
      .filter((t) => t.status === "activo")
      .map((t) => t.team);
  }

  // Etapas posteriores:
  // toma los clasificados de la etapa anterior

  const previousStage = championship.stages.find(
    (s) => s.order === stage.order - 1,
  );

  if (!previousStage) {
    throw new Error("No existe una etapa anterior.");
  }

  validateStageSequence(previousStage, stage);

  const standings = await calculateStandings(championship, previousStage);

  return standings.slice(0, previousStage.qualifyTeams!).map((row) => row.team);
}
