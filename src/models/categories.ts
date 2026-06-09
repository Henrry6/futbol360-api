import { Collections } from "@/libs/useful";
import { Schema, SchemaTypes, Types } from "mongoose";

export interface Category {
  _id: Types.ObjectId;
  championship: Types.ObjectId;
  name: string;
  status: "activo" | "inactivo";
  minAge?: number;
  maxAge?: number;
}

const Category = new Schema<Category>({
  championship: {
    type: SchemaTypes.ObjectId,
    ref: Collections.CHAMPIONSHIP,
    required: true,
  },
  name: { type: String, required: true },
  status: { type: String, default: "activo" },
  minAge: Number,
  maxAge: Number,
});

export default Category;
