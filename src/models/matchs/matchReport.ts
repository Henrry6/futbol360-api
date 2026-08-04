import { Movement } from "@/libs/utils";
import { Collections } from "@/libs/useful";
import { HydratedDocument, Model, Schema, SchemaTypes, Types } from "mongoose";

export interface TeamReport {
  // Equipo al que pertenece la información
  team: Types.ObjectId;

  // Capitán del equipo durante el partido
  captain?: Types.ObjectId;

  // ¿El capitán utilizó cinta reglamentaria?
  captainArmband: boolean;

  // ¿El equipo dejó limpio el camerino?
  dressingRoomClean: boolean;

  // ¿Entregó completos los implementos del camerino?
  dressingRoomEquipment: boolean;

  // Observaciones particulares del equipo
  observations?: string;
}

export interface MatchReport {
  _id: Types.ObjectId;
  league: Types.ObjectId;
  // Campeonato al que pertenece
  championship: Types.ObjectId;

  // Etapa del campeonato (Liga, Semifinal, etc.)
  stage: Types.ObjectId;

  // Jornada del campeonato
  round: Types.ObjectId;

  // Partido al que pertenece esta vocalía
  match: Types.ObjectId;

  // Estado de la vocalía
  // borrador   -> Se creó pero aún no inicia el partido
  // en_juego   -> El partido está en desarrollo
  // finalizada -> El partido terminó y el acta quedó cerrada
  status: "borrador" | "en_juego" | "finalizada";

  // Hora real de inicio del partido
  startTime?: Date;

  // Hora real de finalización
  endTime?: Date;

  // Árbitro principal
  referee: Types.ObjectId;

  // Árbitros asistentes (líneas)
  assistantReferees: Types.ObjectId[];

  // Vocal responsable del partido
  vocal: Types.ObjectId;

  // Cantidad de asistentes al partido
  attendance?: number;

  // Valor recaudado por concepto de entradas
  income?: number;

  // Calificación otorgada al árbitro por el vocal
  refereeRating?: "muy_buena" | "buena" | "regular" | "mala";

  // Informe realizado por el árbitro
  refereeReport?: string;

  // Informe realizado por el vocal
  vocalReport?: string;

  // Observaciones generales del partido
  observations?: string;

  // Información administrativa del equipo local
  local: TeamReport;

  // Información administrativa del equipo visitante
  visitor: TeamReport;
  _movements: Movement[];
}

const TeamReportSchema = new Schema(
  {
    // Equipo
    team: {
      type: SchemaTypes.ObjectId,
      ref: Collections.TEAMS,
      required: true,
    },

    // Capitán del equipo
    captain: {
      type: SchemaTypes.ObjectId,
      ref: Collections.PLAYERS,
    },

    // ¿El capitán utilizó cinta?
    captainArmband: {
      type: Boolean,
      default: false,
    },

    // ¿El equipo entregó limpio el camerino?
    dressingRoomClean: {
      type: Boolean,
      default: false,
    },

    // ¿Entregó completos los implementos?
    dressingRoomEquipment: {
      type: Boolean,
      default: false,
    },

    // Observaciones del equipo
    observations: String,
  },
  {
    _id: false,
  },
);

export interface MatchReportMethods {
  finish(status: "finalizada" | "suspendido", user: string): Promise<void>;
}

export type VocaliaDocument = HydratedDocument<MatchReport, MatchReportMethods>;

export type VocaliaModel = Model<MatchReport, {}, MatchReportMethods>;

const MatchReportSchema = new Schema<MatchReport, VocaliaModel>({
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
    unique: true,
  },

  status: {
    type: String,
    enum: ["borrador", "en_juego", "finalizada"],
    default: "borrador",
  },
  startTime: Date,
  endTime: Date,
  referee: { type: SchemaTypes.ObjectId, ref: Collections.USERS },
  assistantReferees: [{ type: SchemaTypes.ObjectId, ref: Collections.USERS }],
  vocal: { type: SchemaTypes.ObjectId, ref: Collections.USERS },
  attendance: Number,
  income: Number,
  refereeRating: {
    type: String,
    enum: ["muy_buena", "buena", "regular", "mala"],
  },
  refereeReport: String,
  vocalReport: String,
  observations: String,
  local: { type: TeamReportSchema, required: true },
  visitor: { type: TeamReportSchema, required: true },
  _movements: {
    type: [Movement],
  },
});

export default MatchReportSchema;
