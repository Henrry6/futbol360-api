// round-robin-double.ts
// Liga a ida y vuelta: el calendario de ida se repite con la localía invertida.
//
// Ejemplo: 10 equipos → 18 jornadas (9 de ida + 9 de vuelta) = 90 partidos.

import { ClientSession } from "mongoose";
import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";
import { generateRoundRobin } from "./round-robin";
import { Qualifiers } from "./types";

export { validate, nextRound, getQualifiers, getPodium } from "./round-robin";

export function generateFixture(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
  participants: Qualifiers,
  session: ClientSession,
) {
  return generateRoundRobin(championship, stage, participants, session, 2);
}
