import { model } from "mongoose";
import userSchema, { User } from "../../models/users";

export default model<User>("users", userSchema);
