import { Movement } from "@/libs/utils";
import { Collections } from "@/libs/useful";
import { HydratedDocument, Model, Schema, SchemaTypes, Types } from "mongoose";

export interface Match {
  _id: Types.ObjectId;
  league: Types.ObjectId;
  championship: Types.ObjectId;
  round: Types.ObjectId;
  stage: Types.ObjectId;
  localTeam: Types.ObjectId;
  visitorTeam: Types.ObjectId;
  date?: Date;
  hour?: Date;
  vocal?: Types.ObjectId;
  matchReport?: Types.ObjectId;
  referee: Types.ObjectId;
  assistantReferees: Types.ObjectId[];
  localGoals?: number;
  visitorGoals?: number;
  status: "programado" | "en_juego" | "finalizado" | "suspendido";
  observations?: string;
  _movements: Movement[];
}

export interface MatchMethods {
  // start(vocalId: Types.ObjectId): Promise<Match>;
  // revertStart(): Promise<Match>;
}
export type MatchDocument = HydratedDocument<Match, MatchMethods>;

export type MatchModel = Model<Match, {}, MatchMethods>;

const Match = new Schema<Match, MatchModel, MatchDocument>({
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

  round: {
    type: SchemaTypes.ObjectId,
    ref: Collections.ROUNDS,
    required: true,
    index: true,
  },
  stage: { type: SchemaTypes.ObjectId },

  localTeam: {
    type: SchemaTypes.ObjectId,
    ref: Collections.TEAMS,
    required: true,
  },

  visitorTeam: {
    type: SchemaTypes.ObjectId,
    ref: Collections.TEAMS,
    required: true,
  },

  date: { type: Date },
  hour: { type: Date },
  vocal: { type: SchemaTypes.ObjectId, ref: Collections.USERS },
  referee: { type: SchemaTypes.ObjectId, ref: Collections.USERS },
  assistantReferees: [{ type: SchemaTypes.ObjectId, ref: Collections.USERS }],
  matchReport: { type: SchemaTypes.ObjectId, ref: Collections.MATCHS_REPORTS },
  localGoals: { type: Number, default: 0 },
  visitorGoals: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ["programado", "en_juego", "finalizado", "suspendido"],
    default: "programado",
  },

  observations: { type: String },
  _movements: { type: [Movement] },
});

export default Match;
