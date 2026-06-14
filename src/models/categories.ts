import { Movement } from "@/libs/utils";
import { Collections } from "@/libs/useful";
import { Schema, SchemaTypes, Types } from "mongoose";

export interface Category {
  _id: Types.ObjectId;
  league: Types.ObjectId;
  name: string;
  status: "activo" | "inactivo";
  minAge?: number;
  maxAge?: number;
  _movements: Movement[];
}

const Category = new Schema<Category>({
  league: {
    type: SchemaTypes.ObjectId,
    ref: Collections.LEAGUES,
    required: true,
  },
  name: { type: String, required: true },
  status: { type: String, default: "activo" },
  minAge: Number,
  maxAge: Number,
  _movements: { type: [Movement] },
});

export default Category;
