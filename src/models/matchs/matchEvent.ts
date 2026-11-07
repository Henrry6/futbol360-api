import { Movement } from "@/libs/utils";
import { Collections } from "@/libs/useful";
import { Schema, SchemaTypes, Types } from "mongoose";

// esta estructura te permitirá en el futuro generar automáticamente:

// Tabla de goleadores.
// Jugador con más amarillas.
// Jugador con más expulsiones.
// Historial de un jugador.
// Cronología del partido.
// Estadísticas por equipo.

export type MatchEventType =
  | "gol"
  | "penal_fallado"
  | "tarjeta_amarilla"
  | "tarjeta_roja"
  | "cambio";

export interface MatchEvent {
  _id: Types.ObjectId;
  league: Types.ObjectId;

  vocalia: Types.ObjectId;
  // Partido al que pertenece el evento
  match: Types.ObjectId;

  // Campeonato
  championship: Types.ObjectId;

  // Etapa
  stage: Types.ObjectId;

  // Jornada
  round: Types.ObjectId;

  // Equipo involucrado
  team: Types.ObjectId;

  // Jugador involucrado
  player?: Types.ObjectId;

  // Minuto en el que ocurrió
  minute: number;

  // Tipo de evento ocurrido
  type: MatchEventType;

  // Jugador que ingresa (solo para cambios)
  playerIn?: Types.ObjectId;

  // Jugador que sale (solo para cambios)
  playerOut?: Types.ObjectId;

  // Observaciones adicionales
  observations?: string;
  _movements: Movement[];
}

const MatchEventSchema = new Schema<MatchEvent>({
  league: {
    type: SchemaTypes.ObjectId,
    ref: Collections.LEAGUES,
    required: true,
    index: true,
  },

  championship: {
    type: SchemaTypes.ObjectId,
    ref: Collections.CHAMPIONSHIPS,
    required: true,
    index: true,
  },
  vocalia: {
    type: SchemaTypes.ObjectId,
    ref: Collections.MATCHS_REPORTS,
    required: true,
    index: true,
  },

  stage: {
    type: SchemaTypes.ObjectId,
    required: true,
    index: true,
  },

  round: {
    type: SchemaTypes.ObjectId,
    ref: Collections.ROUNDS,
    required: true,
    index: true,
  },

  match: {
    type: SchemaTypes.ObjectId,
    ref: Collections.MATCHES,
    required: true,
    index: true,
  },

  team: {
    type: SchemaTypes.ObjectId,
    ref: Collections.TEAMS,
    required: true,
  },

  player: {
    type: SchemaTypes.ObjectId,
    ref: Collections.PLAYERS,
  },

  minute: {
    type: Number,
    required: true,
    min: 0,
    max: 130,
  },

  type: {
    type: String,
    required: true,
    enum: [
      "gol",
      "autogol",
      "gol_penal",
      "penal_fallado",
      "tarjeta_amarilla",
      "tarjeta_roja",
      "cambio",
    ],
  },

  playerIn: {
    type: SchemaTypes.ObjectId,
    ref: Collections.PLAYERS,
  },

  playerOut: {
    type: SchemaTypes.ObjectId,
    ref: Collections.PLAYERS,
  },

  observations: String,

  _movements: {
    type: [Movement],
  },
});

export default MatchEventSchema;
