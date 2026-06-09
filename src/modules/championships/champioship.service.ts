import { model } from "mongoose";
import ChampionshipSchema, { Championship } from "../../models/champions";

export default model<Championship>("championship", ChampionshipSchema);
