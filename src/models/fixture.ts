import { Movement } from "@/libs/utils";
import { Collections } from "@/libs/useful";
import { Schema, SchemaTypes, Types } from "mongoose";

export interface Fixture {
  _id: Types.ObjectId;

  league: Types.ObjectId;

  championship: Types.ObjectId;

  round: number;

  name: string;
  group?: string;
  stage?:
    | "liga"
    | "grupos"
    | "octavos"
    | "cuartos"
    | "semifinal"
    | "tercer_puesto"
    | "final";

  status: "pendiente" | "en_juego" | "finalizado";

  _movements: Movement[];
}

const Fixture = new Schema<Fixture>({
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
    type: Number,
    required: true,
  },

  name: {
    type: String,
    required: true,
  },
  stage: {
    type: String,
    enum: [
      "liga",
      "grupos",
      "octavos",
      "cuartos",
      "semifinal",
      "tercer_puesto",
      "final",
    ],
  },
  group: {
    type: String,
  },
  status: {
    type: String,
    enum: ["pendiente", "en_juego", "finalizado"],
    default: "pendiente",
  },

  _movements: {
    type: [Movement],
  },
});

export default Fixture;
