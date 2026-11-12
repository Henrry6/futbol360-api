// competicion/
// Lógica de los modos de competencia de una etapa de campeonato.
//
// index.ts              ← registro de modos (este archivo)
// types.ts              ← contrato CompetitionModule, Seed, Qualifiers, Podium
// round-robin.ts        ← liga a una vuelta
// round-robin-double.ts ← liga ida y vuelta
// groups.ts             ← fase de grupos (round-robin dentro de cada grupo)
// knockout.ts           ← eliminación directa, ronda por ronda
// participants.ts       ← qué equipos juegan una etapa (inscritos o clasificados)
// standings.ts          ← tabla de posiciones (round-robin y grupos)
// rankings.ts           ← criterios de desempate
// brackets.ts           ← cruces de la llave (siembra estándar)
// helpers.ts            ← calendario round-robin, crear jornadas/partidos, ganador por penales
//
// Ciclo de vida de una etapa (lo orquesta championship.service.ts):
//
//   pendiente ──generate-fixture──▶ generada ──1er partido iniciado──▶ en_juego
//      ▲                                                                 │
//      └──────────── delete-fixture (sin partidos jugados) ◀─────────────┤
//                                                                        │
//   cada vez que termina una jornada → afterRoundFinished():             │
//     · knockout con más rondas por jugar → nextRound() crea la siguiente│
//     · si no → finalizada; si era la última etapa → finishChampionship()
//
// Encadenar etapas: la etapa N+1 toma los `qualifyTeams` de la etapa N, que debe
// estar finalizada, y su `participants` debe ser igual a ese número.

import * as roundRobin from "./round-robin";
import * as roundRobinDouble from "./round-robin-double";
import * as groups from "./groups";
import * as knockout from "./knockout";
import { CompetitionModule } from "./types";

const competitions: Record<
  "round_robin" | "round_robin_double" | "groups" | "knockout",
  CompetitionModule
> = {
  round_robin: roundRobin,
  round_robin_double: roundRobinDouble,
  groups,
  knockout,
};

export type CompetitionMode = keyof typeof competitions;

export function getCompetition(mode: CompetitionMode): CompetitionModule {
  return competitions[mode];
}
