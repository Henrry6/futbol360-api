import Debug from "debug";
import { FastifyError, hashPassword, sendMail } from "@/libs/utils";
import Users from "@/modules/users/users.service";
import { FastifyReply, FastifyRequest } from "fastify";
import Leagues from "@/modules/leagues/leagues.service";

import { User } from "@/models/users";
import { welcomeEmailTemplate } from "@/libs/templates-emails";
const debug = Debug("src:modules:users");

async function createUsers(
  req: FastifyRequest<{ Body: Partial<User> }>,
  reply: FastifyReply,
) {
  debug("Creando usuario nuevo");
  const usuario = new Users(req.body);
  const password = req.body.password as string;
  usuario.password = await hashPassword(password);
  if (req.payload.league) {
    const liga = await Leagues.findById(req.payload.league);
    if (liga) {
      usuario?.leagues.push(liga._id);
    } else {
      throw new FastifyError("El usuario no se puede asociar a una liga");
    }
  }
  await usuario.save();
  try {
    await sendMail({
      to: usuario.email,
      subject: "Bienvenido al sistema",
      html: welcomeEmailTemplate({
        name: usuario.name,
        username: usuario.username,
        password,
      }),
      text: "adicional",
    });
  } catch (e) {
    console.log(e, "No se pudo enviar el correo del usuario");
  }

  reply.send(usuario);
}
export default {
  createUsers,
};
