// brackets.ts
// Construye los cruces de eliminación directa (funciones puras, sin base de datos).

import { Seed, SeedOrdering } from "./types";

export interface BracketPair {
  // Posición del cruce en la llave (1, 2, 3...). Los ganadores de 1 y 2 se
  // enfrentan en la siguiente ronda, los de 3 y 4 también, etc.
  position: number;
  local: Seed;
  visitor: Seed;
}

/**
 * Orden estándar de siembra para una llave de `size` equipos (potencia de 2).
 *
 * size 8 → [1, 8, 4, 5, 2, 7, 3, 6]  ⇒ cruces 1v8, 4v5, 2v7, 3v6
 *
 * Así el 1º y el 2º solo pueden encontrarse en la final, el 1º y el 4º en semis…
 * (con el orden ingenuo 1v8, 2v7, 3v6, 4v5 el 1º y el 2º chocaban en semifinal).
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, next - seed]);
  }
  return order;
}

/**
 * Crea los cruces de la primera ronda de una llave.
 *
 * - ordering "ranked": usa la siembra estándar (el mejor recibe al peor y los
 *   mejores quedan en lados opuestos). Juega de local el mejor sembrado.
 * - ordering "bracket": empareja de dos en dos (1v2, 3v4…) para continuar una
 *   llave que viene de otra etapa knockout.
 *
 * Si los equipos vienen de grupos, se intenta que nadie repita rival de su
 * mismo grupo en esta ronda intercambiando visitantes entre cruces.
 */
export function createBracket(
  seeds: Seed[],
  ordering: SeedOrdering = "ranked",
): BracketPair[] {
  const total = seeds.length;
  const pairs: BracketPair[] = [];

  if (ordering === "bracket") {
    for (let i = 0; i < total; i += 2) {
      pairs.push({
        position: i / 2 + 1,
        local: seeds[i],
        visitor: seeds[i + 1],
      });
    }
    return pairs;
  }

  const order = seedOrder(total);
  for (let i = 0; i < total; i += 2) {
    pairs.push({
      position: i / 2 + 1,
      local: seeds[order[i] - 1],
      visitor: seeds[order[i + 1] - 1],
    });
  }

  avoidSameGroupPairs(pairs);
  return pairs;
}

/** true si ambos equipos vienen del mismo grupo. */
function sameGroup(a: Seed, b: Seed) {
  return a.group !== undefined && a.group === b.group;
}

/**
 * Intercambia visitantes entre cruces para evitar que dos equipos del mismo
 * grupo se enfrenten. Solo intercambia si ambos cruces quedan sin conflicto.
 * Ejemplo con 2 grupos: [1A v 2A, 1B v 2B] → [1A v 2B, 1B v 2A].
 */
function avoidSameGroupPairs(pairs: BracketPair[]) {
  for (const pair of pairs) {
    if (!sameGroup(pair.local, pair.visitor)) continue;
    const swap = pairs.find(
      (other) =>
        other !== pair &&
        !sameGroup(pair.local, other.visitor) &&
        !sameGroup(other.local, pair.visitor),
    );
    if (swap) {
      [pair.visitor, swap.visitor] = [swap.visitor, pair.visitor];
    }
  }
}

/** Nombre de la ronda según los equipos que la juegan. */
export function knockoutRoundName(teams: number): string {
  switch (teams) {
    case 2:
      return "Final";
    case 4:
      return "Semifinal";
    case 8:
      return "Cuartos de final";
    case 16:
      return "Octavos de final";
    case 32:
      return "Dieciseisavos de final";
    default:
      return `Ronda de ${teams}`;
  }
}

export function isPowerOfTwo(value: number) {
  return Number.isInteger(value) && value >= 2 && (value & (value - 1)) === 0;
}
