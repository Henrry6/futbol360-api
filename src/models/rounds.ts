import { Movement } from "@/libs/utils";
import { Collections } from "@/libs/useful";
import { Schema, SchemaTypes, Types } from "mongoose";

export interface Round {
  _id: Types.ObjectId;
  league: Types.ObjectId;
  championship: Types.ObjectId;
  round: number;
  name: string;
  group?: string;
  // Referencia a la etapa del campeonato
  stage: Types.ObjectId;
  status: "pendiente" | "en_juego" | "finalizado";
  _movements: Movement[];
}

const Round = new Schema<Round>({
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

  round: { type: Number, required: true },
  name: { type: String, required: true },
  stage: { type: SchemaTypes.ObjectId },
  group: { type: String },
  status: {
    type: String,
    enum: ["pendiente", "en_juego", "finalizado"],
    default: "pendiente",
  },

  _movements: {
    type: [Movement],
  },
});

export default Round;
