// rankings.ts
// Ordena tablas de posiciones aplicando los criterios de desempate.

import Debug from "debug";
import { Standing } from "./standings";

const debug = Debug("src:modules:championships:competicion:rankings");

/**
 * Criterios de desempate, en orden de prioridad:
 * 1. Puntos.
 * 2. Diferencia de goles.
 * 3. Goles a favor.
 * 4. Partidos ganados.
 * 5. Id del equipo (solo para que el orden sea siempre el mismo).
 *
 * NOTA: algunos reglamentos usan enfrentamiento directo, fair play o sorteo.
 * Se pueden agregar aquí sin tocar el cálculo de estadísticas.
 */
export function compareStandings(a: Standing, b: Standing): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference) {
    return b.goalDifference - a.goalDifference;
  }
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  if (b.wins !== a.wins) return b.wins - a.wins;
  return a.team.toString().localeCompare(b.team.toString());
}

/** Ordena una tabla y asigna `position` (1, 2, 3…). */
export function rankStandings(standings: Standing[]): Standing[] {
  debug("Generando ranking");
  const table = [...standings].sort(compareStandings);
  table.forEach((row, index) => {
    row.position = index + 1;
  });
  return table;
}

/**
 * Ordena equipos de distintos grupos entre sí (para sembrar la etapa siguiente):
 * primero todos los 1º de grupo, luego todos los 2º, etc.; dentro de cada
 * puesto se aplican los mismos criterios de desempate.
 */
export function rankAcrossGroups(rows: Standing[]): Standing[] {
  return [...rows].sort(
    (a, b) => a.position - b.position || compareStandings(a, b),
  );
}
