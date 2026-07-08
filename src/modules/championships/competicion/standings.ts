// competition

import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";
import { Types } from "mongoose";
import { getStageParticipants } from "./particpants";
import Partidos from "@/modules/matchs/service";
import { rankStandings } from "./rankings";

//     round-robin.ts
//         generateFixture()

//     round-robin-double.ts
//         generateFixture()

//     groups.ts
//         generateFixture()

//     knockout.ts
//         generateFixture()

// standings

//     calculateStandings()

// playoffs

//     qualifyTeams()

// competition/
// │
// ├── round-robin.ts
// ├── round-robin-double.ts
// ├── groups.ts
// ├── knockout.ts
// │
// ├── standings.ts        ← Calcula tablas de posiciones
// ├── qualifiers.ts       ← Obtiene los equipos que avanzan
// ├── rankings.ts         ← Ordena por puntos, DG, GF, etc.
// └── brackets.ts         ← Genera llaves de eliminación

// round-robin.ts: genera jornadas y partidos para todos contra todos.
// groups.ts: genera grupos y sus jornadas.
// knockout.ts: genera las llaves de eliminación.
// standings.ts: calcula las tablas de posiciones cuando aplica.
// qualifiers.ts: determina qué equipos avanzan a la siguiente etapa.
// rankings.ts: aplica los criterios de desempate y ordena la clasificación.
// brackets.ts: construye los cruces de las fases eliminatorias.

// Yo lo estructuraría así:

// competition/
// │
// ├── index.ts
// │
// ├── round-robin.ts
// ├── round-robin-double.ts
// ├── groups.ts
// ├── knockout.ts
// │
// ├── standings.ts
// ├── qualifiers.ts
// ├── rankings.ts
// └── brackets.ts

// Ahora te explico qué hace cada uno.

// round-robin.ts

// Genera las jornadas y partidos de una liga.

// 10 equipos

// ↓

// 9 jornadas

// ↓

// 45 partidos
// round-robin-double.ts

// Hace lo mismo, pero genera dos vueltas.

// Ida

// +

// Vuelta
// groups.ts

// Divide los equipos en grupos.

// Grupo A

// Grupo B

// Grupo C

// Luego usa internamente Round Robin para cada grupo.

// knockout.ts

// Genera una llave.

// Cuartos

// ↓

// Semifinal

// ↓

// Final
// standings.ts

// Calcula la tabla.

// Ejemplo:

// Equipo     PJ PG PE PP GF GC DG PTS

// Aucas      9  7  1  1  20  8  12 22

// No importa si la etapa se llama:

// Liga
// Hexagonal
// Liguilla

// Mientras sea Round Robin, usa este archivo.

// rankings.ts

// Una vez calculada la tabla, hay que ordenarla.

// Por ejemplo

// Empatan en puntos

// Se revisa

// Diferencia de goles
// Goles a favor
// Enfrentamiento directo

// etc.

// Todo eso vive aquí.

// Porque puede cambiar según la liga.

// Incluso podrías configurar reglas distintas.

// qualifiers.ts

// Este archivo responde una sola pregunta.

// ¿Quién clasifica a la siguiente etapa?

// Por ejemplo

// Tabla

// 1 Barcelona

// 2 Liga

// 3 Aucas

// 4 Nacional

// 5 Cuenca

// 6 Macará

// 7 Orense

// Si

// qualifyTeams = 6

// devuelve

// [
//  Barcelona,
//  Liga,
//  Aucas,
//  Nacional,
//  Cuenca,
//  Macará
// ]

// Nada más.

// brackets.ts

// Recibe esos equipos.

// [
// 1,
// 2,
// 3,
// 4,
// 5,
// 6
// ]

// Y arma la llave.

// Ejemplo

// 1 vs 6

// 2 vs 5

// 3 vs 4

// o

// 1 espera

// 2 vs 7

// 3 vs 6

// 4 vs 5

// Dependiendo del reglamento.

// Entonces el flujo completo queda
// Round Robin

// ↓

// standings.ts

// ↓

// rankings.ts

// ↓

// qualifiers.ts

// ↓

// knockout.ts

// ↓

// brackets.ts
// Ejemplo real con tu campeonato

// Tienes:

// Fase Regular

// ↓

// 10 equipos

// ↓

// Clasifican 6

// Cuando termina la liga:

// 1.
// calculateStandings()

// obtiene

// Barcelona 25

// Liga 22

// Aucas 20

// ...
// 2.
// rankings()

// ordena correctamente por los criterios de desempate.

// 3.
// qualifiers()

// devuelve

// Top 6
// 4.
// generateFixture()

// del modo

// knockout

// recibe esos seis equipos.

// 5.
// brackets()

// arma

// 1 vs 6

// 2 vs 5

// 3 vs 4
// Lo bueno de separar qualifiers.ts y brackets.ts

// Imagina estos dos campeonatos:

// Campeonato A
// Liga

// ↓

// Clasifican 4

// ↓

// Semifinales

// qualifiers.ts devuelve:

// 1
// 2
// 3
// 4

// y brackets.ts arma:

// 1 vs 4

// 2 vs 3
// Campeonato B
// Liga

// ↓

// Clasifican 8

// ↓

// Cuartos

// qualifiers.ts devuelve:

// 1
// 2
// 3
// 4
// 5
// 6
// 7
// 8

// y brackets.ts arma:

// 1 vs 8

// 2 vs 7

// 3 vs 6

// 4 vs 5

// Standings = Calcular tabla
import Debug from "debug";
import Equipos from "@/modules/teams/team.service";

const debug = Debug("src:modules:championships:competicion:standings");

export interface Standing {
  // Equipo al que pertenecen las estadísticas.
  team: Types.ObjectId;
  // Nombre del equipo
  name: string;
  // Escudo
  logo?: string;
  // Total de partidos disputados.
  played: number;
  // Partidos ganados.
  wins: number;
  // Partidos empatados.
  draws: number;
  // Partidos perdidos.
  losses: number;
  // Goles anotados a favor.
  goalsFor: number;
  // Goles recibidos.
  goalsAgainst: number;
  // Diferencia de goles (goles a favor - goles en contra).
  goalDifference: number;
  // Puntos obtenidos según el reglamento del campeonato.
  //
  // Normalmente:
  // Victoria = 3
  // Empate = 1
  // Derrota = 0
  points: number;
  position: number;
}

export async function calculateStandings(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
): Promise<Standing[]> {
  debug("Calculando datos estadisticos");
  if (stage.mode === "knockout") {
    throw new Error("Una etapa knockout no tiene tabla de posiciones");
  }
  const matches = await Partidos.find({
    championship: championship._id,
    stage: stage._id,
    status: "finalizado",
  });

  const standings = new Map<string, Standing>();

  const participants = await getStageParticipants(championship, stage);
  const teams = await Equipos.find(
    {
      _id: { $in: participants },
    },
    {
      _id: 1,
      name: 1,
      logo: 1,
    },
  ).lean();
  const teamMap = new Map(teams.map((team) => [team._id.toString(), team]));
  // Inicializamos tabla
  for (const teamId of participants) {
    const team = teamMap.get(teamId.toString());

    standings.set(teamId.toString(), {
      team: teamId,
      name: team?.name ?? "",
      logo: team?.logo,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      position: 0,
    });
  }

  for (const match of matches) {
    if (match.localGoals === undefined || match.visitorGoals === undefined) {
      continue;
    }

    const local = standings.get(match.localTeam.toString());
    const visitor = standings.get(match.visitorTeam.toString());

    if (!local || !visitor) {
      continue;
    }

    const localGoals = match.localGoals;
    const visitorGoals = match.visitorGoals;

    // Partidos jugados
    local.played++;
    visitor.played++;

    // Goles
    local.goalsFor += localGoals;
    local.goalsAgainst += visitorGoals;
    visitor.goalsFor += visitorGoals;
    visitor.goalsAgainst += localGoals;

    // Resultado
    if (localGoals > visitorGoals) {
      local.wins++;
      local.points += 3;

      visitor.losses++;
    } else if (visitorGoals > localGoals) {
      visitor.wins++;
      visitor.points += 3;

      local.losses++;
    } else {
      local.draws++;
      visitor.draws++;

      local.points++;
      visitor.points++;
    }

    local.goalDifference = local.goalsFor - local.goalsAgainst;

    visitor.goalDifference = visitor.goalsFor - visitor.goalsAgainst;
  }

  const table = Array.from(standings.values());

  return rankStandings(table);
}
