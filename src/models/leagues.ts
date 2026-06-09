import { Movement, uniqueDocValidator } from "@/libs/utils";
import {
  Schema,
  Model,
  Types,
  ClientSession,
  HydratedDocument,
} from "mongoose";

export interface League {
  code: string;
  name: string;
  status: "activo" | "inactivo";
  description?: string;
  logo?: string;
  _movements: Movement[];
}
export type LeagueDocument = HydratedDocument<League>;
export interface LigaModel extends Model<League> {
  createDocument(
    this: LigaModel,
    body: League & { _id: string },
    args?: {
      session?: ClientSession;
      isCargaMasiva?: boolean;
      user?: Types.ObjectId;
    },
  ): Promise<LeagueDocument>;
}

const League = new Schema<League, LigaModel>({
  code: {
    type: String,
    required: true,
    validate: uniqueDocValidator(["code"]),
  },
  name: {
    type: String,
    required: true,
    validate: uniqueDocValidator(["name"]),
  },
  status: { type: String, default: "activo" },
  description: String,
  logo: String,
  _movements: { type: [Movement] },
});

export default League;
