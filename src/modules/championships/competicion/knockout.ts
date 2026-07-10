import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";
import { calculateStandings } from "./standings";
import { getQualifiers } from "./qualifiers";
import { createBracket } from "./brackets";
import mongoose from "mongoose";
import { createBracketMatches, createRound } from "./helpers";

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

export async function generateKnockout(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
) {
  //2. Obtener la etapa anterior
  const previousStage = championship.stages.find(
    (s) => s.order === stage.order - 1,
  );

  if (!previousStage) {
    throw new Error("No existe una etapa anterior.");
  }

  // 3. Calcular la tabla
  const standings = await calculateStandings(championship, previousStage);
  // 4. Obtener clasificados
  const qualifiers = getQualifiers(standings, previousStage.qualifyTeams!);
  // 5. Crear la llave
  const bracket = createBracket(qualifiers);
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const round = await createRound(
      championship,
      stage,
      1,
      session,
      stage.name,
    );
    await createBracketMatches(
      championship,
      round._id,
      stage,
      bracket,
      session,
    );

    stage.status = "generada";

    await championship.save({
      session,
    });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();

    throw error;
  } finally {
    session.endSession();
  }
}

export async function generateFixture() {}

export async function nextRound() {}

export async function finishChampionship() {}
