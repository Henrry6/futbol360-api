import Debug from "debug";
import { model, Types } from "mongoose";
import Partidos from "../matchs/service";
import { Collections } from "@/libs/useful";
import mongooseSmartQuery from "mongoose-smart-query";
import Vocalias from "../matchReports/matchReport.service";
import { FastifyError, msqTemporalOptions } from "@/libs/utils";
import MatchEventSchema, { MatchEvent } from "../../models/matchs/matchEvent";
const debug = Debug("src:modules:matchEvents:service");

async function updateMatchScore(matchId: Types.ObjectId) {
  const match = await Partidos.findById(matchId)
    .select("localTeam visitorTeam")
    .lean();

  if (!match) {
    return;
  }

  const [localGoals, visitorGoals] = await Promise.all([
    Eventos.countDocuments({
      match: matchId,
      team: match.localTeam,
      type: "gol",
    }),
    Eventos.countDocuments({
      match: matchId,
      team: match.visitorTeam,
      type: "gol",
    }),
  ]);

  await Partidos.updateOne(
    { _id: matchId },
    {
      localGoals,
      visitorGoals,
    },
  );
}
MatchEventSchema.plugin(mongooseSmartQuery, {
  defaultFields: "player minute type observations team playerIn playerOut",
  fieldsForDefaultQuery: "observations type player",
  ...msqTemporalOptions,
});

MatchEventSchema.index({
  match: 1,
  minute: 1,
});

MatchEventSchema.pre("validate", async function (this) {
  const report = await Vocalias.findById(this.vocalia).select("status").lean();

  if (!report) {
    throw new FastifyError("La vocalía no existe.");
  }

  if (report.status === "finalizada") {
    throw new FastifyError(
      "La vocalía ya fue finalizada por lo que ya no se permite actualizar.",
    );
  }
});

MatchEventSchema.post("save", async function (this) {
  if (this.type === "gol") {
    debug("Actualizando Marcador", this.team);
    await updateMatchScore(this.match);
  }
});

const Eventos = model<MatchEvent>(Collections.MATCHS_EVENTS, MatchEventSchema);
export default Eventos;
