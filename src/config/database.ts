import mongoose from "mongoose";

import { env } from "./env";

export async function connectDatabase() {
  await mongoose.connect(env.mongoUri || "mongodb://localhost:27017/futbol360");

  console.log("Mongo conectado");
}
