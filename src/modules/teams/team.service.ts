import { model } from "mongoose";
import TeamSchema, { Team } from "../../models/teams";

export default model<Team>("teams", TeamSchema);
