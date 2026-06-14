import { Movement } from "@/libs/utils";
import { Collections } from "@/libs/useful";
import { Schema, SchemaTypes, Types } from "mongoose";

export interface Team {
  _id: Types.ObjectId;
  league: Types.ObjectId;
  name: string;
  representative: string;
  fundacion?: number;
  logo?: string;
  phone?: string;
  directorio?: {
    presidente: string;
    vicepresidente: string;
    secretarios: string;
    tesorero: string;
  };
  status: "activo" | "inactivo";
  _movements: Movement[];
}

const Team = new Schema<Team>({
  league: {
    type: SchemaTypes.ObjectId,
    ref: Collections.LEAGUES,
    required: true,
  },
  name: { type: String, required: true },
  representative: { type: String, required: true },
  fundacion: { type: Number },
  logo: { type: String },
  phone: { type: String },
  status: { type: String, default: "activo" },
  _movements: { type: [Movement] },
});

export default Team;
