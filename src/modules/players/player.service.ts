import { model } from "mongoose";
import PlayerSchema, { Player } from "../../models/players";

export default model<Player>("players", PlayerSchema);
