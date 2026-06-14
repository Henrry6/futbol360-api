import { Movement } from "@/libs/utils";
import { Collections } from "@/libs/useful";
import { Schema, SchemaTypes, Types } from "mongoose";

export interface ChampionshipTeam {
  team: Types.ObjectId;
  status: "activo" | "retirado" | "expulsado";
  // Fecha en la que union al campeonato
  joinedAt: Date;
  // Fecha de salida
  leftAt?: Date;
  // Posición final
  finalPosition?: number;
  // Puntos obtenidos
  points?: number;
  notes?: string;
}

const ChampionshipTeamSchema = new Schema<ChampionshipTeam>(
  {
    team: {
      type: SchemaTypes.ObjectId,
      ref: Collections.TEAMS,
      required: true,
    },
    status: {
      type: String,
      enum: ["activo", "retirado", "expulsado"],
      default: "activo",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: Date,
    finalPosition: Number,
    points: Number,
    notes: String,
  },
  {
    _id: false,
  },
);

export interface Championship {
  _id: Types.ObjectId;
  league: Types.ObjectId;
  name: string;
  category: Types.ObjectId;
  // Año deportivo
  season: string;
  // Apertura, Clausura, Temporada, Copa, etc.
  type: "temporada" | "apertura" | "clausura" | "copa" | "amistoso";
  startDate: Date;
  endDate?: Date;
  // Equipos participantes
  teams: ChampionshipTeam[];
  // Campeón
  champion?: Types.ObjectId;
  // Subcampeón
  runnerUp?: Types.ObjectId;
  // Tercer lugar
  thirdPlace?: Types.ObjectId;
  // Estado
  status: "planificado" | "activo" | "finalizado" | "cancelado";
  observations?: string;
  _movements: Movement[];
}
const ChampionshipSchema = new Schema<Championship>({
  league: {
    type: SchemaTypes.ObjectId,
    ref: Collections.LEAGUES,
    required: true,
  },
  category: {
    type: SchemaTypes.ObjectId,
    ref: Collections.CATEGORYS,
    required: true,
  },
  name: { type: String, required: true, trim: true },
  season: { type: String, required: true },
  type: {
    type: String,
    enum: ["temporada", "apertura", "clausura", "copa", "amistoso"],
    default: "temporada",
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: Date,
  teams: { type: [ChampionshipTeamSchema], default: [] },
  champion: { type: SchemaTypes.ObjectId, ref: Collections.TEAMS },
  runnerUp: { type: SchemaTypes.ObjectId, ref: Collections.TEAMS },
  thirdPlace: { type: SchemaTypes.ObjectId, ref: Collections.TEAMS },
  status: {
    type: String,
    enum: ["planificado", "activo", "finalizado", "cancelado"],
    default: "activo",
  },
  observations: String,
  _movements: { type: [Movement] },
});

export default ChampionshipSchema;
