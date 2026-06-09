import { Schema, Types } from "mongoose";

export interface League {
  _id: Types.ObjectId;
  code: string;
  name: string;
  status: "activo" | "inactivo";
  description?: string;
  logo?: string;
}

const League = new Schema<League>({
  code: { type: String, required: true },
  name: { type: String, required: true },
  status: { type: String, default: "activo" },
  description: String,
  logo: String,
});

export default League;
