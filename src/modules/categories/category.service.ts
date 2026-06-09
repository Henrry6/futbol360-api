import { model } from "mongoose";
import CategoySchema, { Category } from "../../models/categories";

export default model<Category>("categories", CategoySchema);
