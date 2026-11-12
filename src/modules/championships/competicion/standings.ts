// standings.ts
// Calcula la tabla de posiciones de una etapa round-robin o de grupos.

import Debug from "debug";
import { Types } from "mongoose";
import { FastifyError } from "@/libs/utils";
import Partidos from "@/modules/matchs/service";
import Equipos from "@/modules/teams/team.service";
import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";
import { rankStandings } from "./rankings";
import { getStageParticipants } from "./participants";

const debug = Debug("src:modules:championships:competicion:standings");

export interface Standing {
  // Equipo al que pertenecen las estadísticas.
  team: Types.ObjectId;
  // Nombre del equipo
  name: string;
  // Escudo (publicId de Cloudinary)
  logo?: string;
  // Grupo (solo en etapas "groups")
  group?: string;
  // Partidos jugados, ganados, empatados y perdidos.
  played: number;
  wins: number;
  draws: number;
  losses: number;
  // Goles a favor, en contra y diferencia.
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  // Victoria = 3, empate = 1, derrota = 0
  points: number;
  // Posición en la tabla (en grupos: posición dentro del grupo).
  position: number;
}

/** Estados de partido que cuentan para la tabla (en_juego = tabla en vivo). */
const COUNTED_STATUSES = ["en_juego", "finalizado", "suspendido"];

/**
 * Equipos de la tabla:
 * - grupos: la composición guardada al generar el fixture;
 * - round-robin con fixture: los equipos de sus partidos;
 * - sin fixture: los participantes que tendría la etapa (todos en 0), o una
 *   tabla vacía si aún no se pueden calcular (etapa anterior sin terminar).
 */
async function getTableTeams(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
): Promise<{ team: Types.ObjectId; group?: string }[]> {
  if (stage.mode === "groups") {
    return (stage.groupsTeams ?? []).flatMap((g) =>
      g.teams.map((team) => ({ team, group: g.name })),
    );
  }

  const [locals, visitors] = await Promise.all([
    Partidos.distinct("localTeam", {
      championship: championship._id,
      stage: stage._id,
    }),
    Partidos.distinct("visitorTeam", {
      championship: championship._id,
      stage: stage._id,
    }),
  ]);
  const ids = new Map<string, Types.ObjectId>();
  [...locals, ...visitors].forEach((id) => ids.set(id.toString(), id));
  if (ids.size > 0) return [...ids.values()].map((team) => ({ team }));

  try {
    const { seeds } = await getStageParticipants(championship, stage);
    return seeds.map((s) => ({ team: s.team }));
  } catch {
    return [];
  }
}

export async function calculateStandings(
  championship: ChampionshipDocument,
  stage: ChampionshipStage,
): Promise<Standing[]> {
  debug("Calculando tabla de", stage.name);
  if (stage.mode === "knockout") {
    throw new FastifyError("Una etapa de eliminación directa no tiene tabla de posiciones.");
  }

  const [tableTeams, matches] = await Promise.all([
    getTableTeams(championship, stage),
    Partidos.find(
      {
        championship: championship._id,
        stage: stage._id,
        status: { $in: COUNTED_STATUSES },
      },
      { localTeam: 1, visitorTeam: 1, localGoals: 1, visitorGoals: 1 },
    ).lean(),
  ]);

  const teams = await Equipos.find(
    { _id: { $in: tableTeams.map((t) => t.team) } },
    { name: 1, logo: 1 },
  ).lean();
  const teamMap = new Map(teams.map((team) => [team._id.toString(), team]));

  // Inicializamos la tabla en 0
  const standings = new Map<string, Standing>();
  for (const { team: teamId, group } of tableTeams) {
    const team = teamMap.get(teamId.toString());
    standings.set(teamId.toString(), {
      team: teamId,
      name: team?.name ?? "",
      logo: team?.logo,
      group,
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
    const local = standings.get(match.localTeam.toString());
    const visitor = standings.get(match.visitorTeam.toString());
    if (!local || !visitor) continue;

    const localGoals = match.localGoals ?? 0;
    const visitorGoals = match.visitorGoals ?? 0;

    local.played++;
    visitor.played++;
    local.goalsFor += localGoals;
    local.goalsAgainst += visitorGoals;
    visitor.goalsFor += visitorGoals;
    visitor.goalsAgainst += localGoals;

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

  const rows = [...standings.values()];

  if (stage.mode !== "groups") {
    return rankStandings(rows);
  }

  // Grupos: se ordena cada grupo por separado (A, B, C…), posición dentro del grupo
  const groupNames = [...new Set(rows.map((r) => r.group ?? ""))].sort();
  return groupNames.flatMap((name) =>
    rankStandings(rows.filter((r) => (r.group ?? "") === name)),
  );
}
