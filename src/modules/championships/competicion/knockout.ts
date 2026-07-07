import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";

export function validateStage(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
) {
  if (!stage.participants) {
    throw new Error("Debe indicar los participantes.");
  }

  if (!Number.isInteger(Math.log2(stage.participants))) {
    throw new Error(
      "Una eliminación directa requiere 2, 4, 8, 16, 32... participantes.",
    );
  }
}

export async function generateFixture() {}

export async function nextRound() {}

export async function finishChampionship() {}
