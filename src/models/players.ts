import { Collections } from "@/libs/useful";
import { Schema, SchemaTypes, Types } from "mongoose";

export interface Player {
  _id: Types.ObjectId;
  team: Types.ObjectId;
  identification: string;
  names: string;
  lastName: string;
  birthDate: Date;
  jerseyNumber: number;
  photo?: string;
  position?: string;
  status: "activo" | "inactivo";
}

const Player = new Schema<Player>({
  team: {
    type: SchemaTypes.ObjectId,
    ref: Collections.LEAGUES,
    required: true,
  },
  identification: { type: String, required: true },
  names: { type: String, required: true },
  lastName: { type: String, required: true },
  birthDate: { type: Date, required: true },
  jerseyNumber: { type: Number, required: true },
  photo: String,
  position: String,
  status: { type: String, default: "activo" },
});

export default Player;
