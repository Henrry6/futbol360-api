import { Schema, Types } from "mongoose";

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
  role: "master" | "admin" | "directivo" | "player";
  leagues: Schema.Types.ObjectId[];
  active: boolean;
}

const UserSchema = new Schema<User>(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: Object.values(UserRole), required: true },
    leagues: [
      {
        type: Schema.Types.ObjectId,
        ref: "leagues",
      },
    ],
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

export default UserSchema;
