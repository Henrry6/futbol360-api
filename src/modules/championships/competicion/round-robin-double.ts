import { generateRoundRobinFixture } from "./round-robin";
import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";

export async function generateFixture(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
) {
  return generateRoundRobinFixture({
    championship,
    stage,
    legs: 2,
  });
}
