import Users from "@/modules/users/users.service";
// import { comparePassword } from "../../utils";

export async function login(username: string, password: string) {
  const user = await Users.findOne({
    username,
    active: true,
  }).select("+password");

  if (!user) {
    throw new Error("Usuario o contraseña incorrectos");
  }
  // const isValid = await comparePassword(password, user.password);
  // if (!isValid) {
  //   throw new Error("Usuario o contraseña incorrectos");
  // }

  return user;
}
