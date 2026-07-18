import { Collections } from "@/libs/useful";
import { Movement } from "@/libs/utils";
import { Schema, Types, Document, SchemaTypes } from "mongoose";

export enum UserRole {
  MASTER = "master",
  ADMIN = "admin",
  DIRECTIVO = "directivo",
  PLAYER = "player",
}
export interface User {
  _id: Types.ObjectId;
  name: string;
  username: string;
  email: string;
  password: string;
  roles: ("master" | "admin" | "directivo" | "player" | "official")[];
  official?: {
    canReferee: boolean;
    canAssist: boolean;
    canBeVocal: boolean;
  };
  leagues: Types.ObjectId[];
  status: "activo" | "inactivo";
  _movements: Movement[];
}

export type UserDocument = User & Document;

const UserSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    roles: { type: [String], enum: Object.values(UserRole), required: true },
    leagues: [
      {
        type: SchemaTypes.ObjectId,
        ref: Collections.USERS,
      },
    ],
    status: { type: String, default: "activo" },
    _movements: { type: [Movement] },
  },
  {
    timestamps: true,
  },
);

export default UserSchema;
