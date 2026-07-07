import { Movement } from "@/libs/utils";
import { Collections } from "@/libs/useful";
import { Schema, SchemaTypes, Types } from "mongoose";

export interface Match {
  _id: Types.ObjectId;
  league: Types.ObjectId;
  championship: Types.ObjectId;
  round: Types.ObjectId;
  stage: Types.ObjectId;
  localTeam: Types.ObjectId;
  visitorTeam: Types.ObjectId;
  date?: Date;
  localGoals?: number;
  visitorGoals?: number;
  status: "programado" | "en_juego" | "finalizado" | "suspendido";
  observations?: string;
  _movements: Movement[];
}

const Match = new Schema<Match>({
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

  date: {
    type: Date,
  },

  localGoals: {
    type: Number,
    default: 0,
  },

  visitorGoals: {
    type: Number,
    default: 0,
  },

  status: {
    type: String,
    enum: ["programado", "en_juego", "finalizado", "suspendido"],
    default: "programado",
  },

  observations: {
    type: String,
  },

  _movements: {
    type: [Movement],
  },
});

export default Match;
