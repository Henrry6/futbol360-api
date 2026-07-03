import { Collections } from "@/libs/useful";
import { Schema, SchemaTypes, Types } from "mongoose";
import { Movement, uniqueDocValidator } from "@/libs/utils";

export interface Player {
  _id: Types.ObjectId;
  team: Types.ObjectId;
  league: Types.ObjectId;
  cedula: string;
  names: string;
  lastName: string;
  birthDate: Date;
  jerseyNumber: number;
  photo?: string;
  position:
    | "portero"
    | "defensa"
    | "lateral_derecho"
    | "lateral_izquierdo"
    | "volante"
    | "mediocampista"
    | "extremo_derecho"
    | "extremo_izquierdo"
    | "delantero";
  status: "activo" | "inactivo";
  _movements: Movement[];
}

const Player = new Schema<Player>({
  league: {
    type: SchemaTypes.ObjectId,
    ref: Collections.LEAGUES,
    required: true,
  },
  team: {
    type: SchemaTypes.ObjectId,
    ref: Collections.TEAMS,
    required: true,
  },
  cedula: {
    type: String,
    required: true,
    validate: uniqueDocValidator(["cedula"]),
    minLength: 10,
  },
  names: { type: String, required: true },
  lastName: { type: String, required: true },
  birthDate: { type: Date, required: true },
  jerseyNumber: { type: Number, required: true },
  photo: String,
  position: { type: String, required: true },
  status: { type: String, default: "activo" },
  _movements: { type: [Movement] },
});

export default Player;
