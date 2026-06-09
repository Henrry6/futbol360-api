import { Collections } from "@/libs/useful";
import { Schema, SchemaTypes, Types } from "mongoose";

export interface Championship {
  _id: Types.ObjectId;
  league: Types.ObjectId;
  name: string;
  year: number;
  startDate: Date;
  endDate?: Date;
  status: "activo" | "inactivo";
}

const Championship = new Schema<Championship>({
  league: {
    type: SchemaTypes.ObjectId,
    ref: Collections.LEAGUES,
    required: true,
  },
  name: { type: String, required: true },
  year: { type: Number, required: true },
  status: { type: String, default: "activo" },
  startDate: { type: Date, default: new Date() },
  endDate: Date,
});

export default Championship;
