import { hashPassword } from "./utils/hash";
import Users from "./modules/users/users.service";

export async function seedMaster() {
  console.log("Ejecutando seed...");
  const exists = await Users.findOne({
    email: "admin@futbol360.com",
  });

  if (exists) {
    console.log("Saltando seed, el MASTER ya existe");
    return;
  }

  try {
    await Users.create({
      name: "Master",
      username: "master",
      email: "admin@futbol360.com",
      password: await hashPassword("123456"),
      role: "master",
    });
    console.log("MASTER creado");
  } catch (error) {
    console.error(error);
  }
}
