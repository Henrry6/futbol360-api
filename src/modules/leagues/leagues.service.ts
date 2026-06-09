import { model } from "mongoose";
import LeagueSchema, { League } from "../../models/leagues";

LeagueSchema.post("save", async function () {
  console.log(this, "DATA LEAGUE 11111");
  if (this.isNew) {
    console.log(this, "DATA LEAGUE 2222");
  }
});

export default model<League>("leagues", LeagueSchema);
