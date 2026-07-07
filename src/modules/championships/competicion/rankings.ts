// Ordenar desempates

import { Standing } from "./standings";
import Debug from "debug";
const debug = Debug("src:modules:championships:competicion:rankings");

/**
 * Ordena la tabla de posiciones aplicando los criterios de desempate.
 *
 * Orden de prioridad:
 * 1. Puntos.
 * 2. Diferencia de goles.
 * 3. Goles a favor.
 * 4. Partidos ganados.
 * 5. Id del equipo (para mantener un orden determinístico).
 *
 * NOTA:
 * Algunos reglamentos utilizan enfrentamiento directo,
 * fair play o sorteo. Esa lógica puede agregarse aquí
 * en el futuro sin modificar el cálculo de estadísticas.
 */

export function rankStandings(standings: Standing[]): Standing[] {
  debug("Generando ranking");

  const table = [...standings];
  table.sort((a, b) => {
    // 1. Mayor cantidad de puntos
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    // 2. Mayor diferencia de goles
    if (b.goalDifference !== a.goalDifference) {
      return b.goalDifference - a.goalDifference;
    }

    // 3. Mayor cantidad de goles a favor
    if (b.goalsFor !== a.goalsFor) {
      return b.goalsFor - a.goalsFor;
    }

    // 4. Mayor cantidad de partidos ganados
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }

    // 5. Orden estable
    return a.team.toString().localeCompare(b.team.toString());
  });

  table.forEach((row, index) => {
    row.position = index + 1;
  });

  return table;
}
