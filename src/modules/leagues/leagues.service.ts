import { model } from "mongoose";
import LeagueSchema, { League } from "../../models/leagues";

export default model<League>("leagues", LeagueSchema);
