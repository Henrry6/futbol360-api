// Definir quién avanza
import { Standing } from "./standings";

export function getQualifiers(
  standings: Standing[],
  qualifyTeams: number,
): Standing[] {
  if (qualifyTeams <= 0) {
    return [];
  }

  if (qualifyTeams > standings.length) {
    throw new Error(
      "La cantidad de clasificados no puede ser mayor al número de equipos.",
    );
  }

  return standings.slice(0, qualifyTeams);
}
