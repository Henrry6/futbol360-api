import { ClientSession, Types } from "mongoose";
import { ChampionshipDocument, ChampionshipStage } from "@/models/champions";

/**
 * Un equipo que entra a una etapa, en orden de siembra (el primero es el mejor).
 * `group` y `groupPosition` solo existen cuando viene de una fase de grupos y se
 * usan para evitar que dos equipos del mismo grupo se crucen en la primera llave.
 */
export interface Seed {
  team: Types.ObjectId;
  group?: string;
  groupPosition?: number;
}

/**
 * Cómo deben emparejarse los clasificados en una llave:
 * - "ranked":  vienen ordenados por rendimiento → 1º vs último, 2º vs penúltimo…
 * - "bracket": vienen en orden de llave (ganador cruce 1, ganador cruce 2…) →
 *              se emparejan de dos en dos para continuar la misma llave.
 */
export type SeedOrdering = "ranked" | "bracket";

export interface Qualifiers {
  seeds: Seed[];
  ordering: SeedOrdering;
}

export interface Podium {
  champion?: Types.ObjectId;
  runnerUp?: Types.ObjectId;
  thirdPlace?: Types.ObjectId;
}

/**
 * Contrato que implementa cada modo de competencia (round-robin, grupos, knockout).
 * El servicio del campeonato se encarga de sesiones, estados de la etapa y
 * guardar el campeonato; los módulos solo crean jornadas/partidos y calculan.
 */
export interface CompetitionModule {
  /** Valida la configuración de la etapa y los participantes antes de generar. */
  validate(stage: ChampionshipStage, participants: Seed[]): void;

  /** Crea jornadas y partidos de la etapa (dentro de la transacción `session`). */
  generateFixture(
    championship: ChampionshipDocument,
    stage: ChampionshipStage,
    participants: Qualifiers,
    session: ClientSession,
  ): Promise<void>;

  /**
   * Se llama cuando todas las jornadas creadas de la etapa terminaron.
   * Si el modo necesita otra ronda (knockout) la crea y devuelve true;
   * si la etapa ya está completa devuelve false.
   */
  nextRound(
    championship: ChampionshipDocument,
    stage: ChampionshipStage,
    session: ClientSession,
  ): Promise<boolean>;

  /** Equipos que pasan a la siguiente etapa (la etapa debe estar finalizada). */
  getQualifiers(
    championship: ChampionshipDocument,
    stage: ChampionshipStage,
  ): Promise<Qualifiers>;

  /** Campeón, subcampeón y tercero si esta etapa es la última del campeonato. */
  getPodium(
    championship: ChampionshipDocument,
    stage: ChampionshipStage,
  ): Promise<Podium>;
}
