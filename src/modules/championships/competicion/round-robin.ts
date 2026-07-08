// round-robin.ts
// Generar jornadas todos contra todos
import mongoose from "mongoose";
import { getStageParticipants } from "./particpants";
import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";
import { createMatches, createRound, prepareTeams, rotate } from "./helpers";

interface GenerateRoundRobinFixtureOptions {
  championship: ChampionshipDocument;
  stage: ChampionshipStage;
  legs: 1 | 2;
}
function validateStage(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
) {
  if (!stage.participants) {
    throw new Error("Debe indicar la cantidad de participantes.");
  }
  if (championship.teams.length < 2) {
    throw new Error("Debe existir al menos dos equipos");
  }

  if (stage.participants && championship.teams.length !== stage.participants) {
    throw new Error(`La etapa requiere ${stage.participants} equipos.`);
  }
  if (stage.qualifyTeams && stage.qualifyTeams >= stage.participants) {
    throw new Error(
      "Los clasificados deben ser menores que los participantes.",
    );
  }

  if (stage.status !== "pendiente") {
    throw new Error("La etapa ya fue generada.");
  }
}

export async function generateRoundRobinFixture({
  championship,
  stage,
  legs,
}: GenerateRoundRobinFixtureOptions) {
  validateStage(championship, stage);

  const participants = await getStageParticipants(championship, stage);

  const teams = prepareTeams(participants);

  const roundsPerLeg = teams.length - 1;

  const matchesPerRound = teams.length / 2;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    for (let leg = 0; leg < legs; leg++) {
      let rotation = [...teams];

      for (let round = 0; round < roundsPerLeg; round++) {
        const roundNumber = leg * roundsPerLeg + round;

        const roundDoc = await createRound(
          championship,
          stage,
          roundNumber,
          session,
        );

        await createMatches(
          championship,
          roundDoc._id,
          stage,
          rotation,
          matchesPerRound,
          leg === 1, // true = invertir localía
          session,
        );

        rotation = rotate(rotation);
      }
    }

    stage.status = "generada";

    await championship.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function generateFixture(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
) {
  return generateRoundRobinFixture({
    championship,
    stage,
    legs: 1,
  });
}
