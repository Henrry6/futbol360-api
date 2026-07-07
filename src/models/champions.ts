import { Movement } from "@/libs/utils";
import { Collections } from "@/libs/useful";
import { HydratedDocument, Schema, SchemaTypes, Types, Model } from "mongoose";

export interface ChampionshipStage extends Types.Subdocument {
  _id: Types.ObjectId;
  order: number;
  name: string;
  mode: "round_robin" | "round_robin_double" | "groups" | "knockout";
  status: "pendiente" | "generada" | "activa" | "finalizada";
  // Solo para grupos
  groups?: number;

  // Clasificados a la siguiente etapa
  qualifyTeams?: number;

  // Para eliminación directa
  thirdPlaceMatch?: boolean;
  participants?: number;
}

const ChampionshipStageSchema = new Schema<ChampionshipStage>({
  order: { type: Number, required: true },
  name: { type: String, required: true },
  mode: {
    type: String,
    enum: ["round_robin", "round_robin_double", "groups", "knockout"],
    default: "round_robin",
  },
  status: {
    type: String,
    enum: ["pendiente", "generada", "activa", "finalizada"],
    default: "pendiente",
  },
  groups: { type: Number },
  participants: { type: Number },
  qualifyTeams: { type: Number },
  thirdPlaceMatch: { type: Boolean },
});

export interface ChampionshipTeam {
  team: Types.ObjectId;
  status: "activo" | "retirado" | "expulsado";
  // Fecha en la que union al campeonato
  fechaIngreso: Date;
  // Fecha de salida
  fechaSalida?: Date;
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
    fechaIngreso: {
      type: Date,
      default: Date.now,
    },
    fechaSalida: Date,
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
  season: Date;
  // Apertura, Clausura, Temporada, Copa, etc.
  type: "temporada" | "apertura" | "clausura" | "copa" | "amistoso";
  startDate: Date;
  endDate?: Date;
  // Equipos participantes
  teams: ChampionshipTeam[];
  stages: Types.DocumentArray<ChampionshipStage>;
  currentStage: number;
  // Campeón
  champion?: Types.ObjectId;
  // Subcampeón
  runnerUp?: Types.ObjectId;
  // Tercer lugar
  thirdPlace?: Types.ObjectId;
  // Estado
  status: "planificado" | "activo" | "finalizado" | "cancelado";
  observations?: string;
  competitionMode: "round_robin" | "round_robin_double" | "groups" | "knockout";
  _movements: Movement[];
}

export interface ChampionshipMethods {
  generateFixture(this: ChampionshipDocument): Promise<void>;
  deleteFixture(this: ChampionshipDocument, etapaId: string): Promise<void>;
  calculateStandings(): Promise<void>;
  nextRound(): Promise<void>;
  finishChampionship(): Promise<void>;
}

export type ChampionshipDocument = HydratedDocument<
  Championship,
  ChampionshipMethods
>;

export type ChampionshipModel = Model<Championship, {}, ChampionshipMethods>;

const ChampionshipSchema = new Schema<
  Championship,
  ChampionshipModel,
  ChampionshipMethods
>({
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
  season: { type: Date, required: true },
  type: {
    type: String,
    enum: ["temporada", "apertura", "clausura", "copa", "amistoso"],
    default: "temporada",
  },
  competitionMode: {
    type: String,
    enum: ["round_robin", "round_robin_double", "groups", "knockout"],
    default: "round_robin",
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: Date,
  teams: { type: [ChampionshipTeamSchema], default: [] },
  stages: { type: [ChampionshipStageSchema], default: [] },
  currentStage: { type: Number, default: 0 },
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
