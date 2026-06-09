import { Collections } from "@/libs/useful";
import { Schema, SchemaTypes, Types } from "mongoose";

export interface Team {
  _id: Types.ObjectId;
  category: Types.ObjectId;
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
}

const Team = new Schema<Team>({
  category: {
    type: SchemaTypes.ObjectId,
    ref: Collections.CATEGORY,
    required: true,
  },
  name: { type: String, required: true },
  representative: { type: String, required: true },
  fundacion: { type: Number },
  logo: { type: String },
  phone: { type: String },
  status: { type: String, default: "activo" },
});

export default Team;
