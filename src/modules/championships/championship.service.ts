import { model } from "mongoose";
import { getCompetition } from "./competicion";
import { msqTemporalOptions } from "@/libs/utils";
import mongooseSmartQuery from "mongoose-smart-query";
import ChampionshipSchema, {
  Championship,
  ChampionshipDocument,
  ChampionshipModel,
} from "../../models/champions";

ChampionshipSchema.plugin(mongooseSmartQuery, {
  defaultFields: "name league categoy teams",
  fieldsForDefaultQuery: "name code",
  ...msqTemporalOptions,
});

ChampionshipSchema.methods.generateFixture = async function (
  this: ChampionshipDocument,
) {
  return getCompetition(this.competitionMode).generateFixture(this);
};

export default model<Championship, ChampionshipModel>(
  "championship",
  ChampionshipSchema,
);
