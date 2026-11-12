import { Collections } from "@/libs/useful";
import { Movement } from "@/libs/utils";
import { Schema, Types, Document, SchemaTypes } from "mongoose";

export enum UserRole {
  MASTER = "master",
  ADMIN = "admin",
  DIRECTIVO = "directivo",
  OFICIAL = "official",
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
    // Árbitro principal
    canReferee: boolean;
    // Árbitros asistentes (líneas)
    canAssist: boolean;
    // Vocal responsable del partido
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
    password: { type: String, required: true, select: false },
    email: { type: String, required: true, unique: true },
    roles: { type: [String], enum: Object.values(UserRole), required: true },
    leagues: [
      {
        type: SchemaTypes.ObjectId,
        ref: Collections.LEAGUES,
      },
    ],
    official: {
      canReferee: { type: Boolean, default: false },
      canAssist: { type: Boolean, default: false },
      canBeVocal: { type: Boolean, default: false },
    },
    status: { type: String, default: "activo" },
    _movements: { type: [Movement] },
  },
  {
    timestamps: true,
    // Nunca serializar el hash al responder (reply.send usa toJSON).
    // toObject() no se modifica: users.controller lo usa para el deepmerge.
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.password;
        return ret;
      },
    },
  },
);

export default UserSchema;
