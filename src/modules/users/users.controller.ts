import Debug from "debug";
import Users from "@/modules/users/users.service";
import { FastifyReply, FastifyRequest } from "fastify";
import Leagues from "@/modules/leagues/leagues.service";
import {
  deepmerge,
  FastifyError,
  getMovimiento,
  hashPassword,
  sendMail,
} from "@/libs/utils";
import { getUserIds } from "@/libs/UpRouter";

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
async function updateUser(
  req: FastifyRequest<{ Params: { id: string }; Body: Partial<User> }>,
  reply: FastifyReply,
) {
  debug("Editando usuario", req.params.id);
  const documento = await Users.findById(req.params.id);
  if (!documento)
    throw new FastifyError("No se encontró el documento a editar", 404);

  const body: any = { ...req.body };
  delete body._id;
  delete body.__v;
  if (body.password) {
    body.password = await hashPassword(body.password);
  }

  documento.$locals.docOriginal = documento.toObject();
  documento.set(deepmerge(documento.toObject(), body));
  if (documento.isModified()) {
    documento._movements?.push(
      (await getMovimiento({
        type: "edit",
        ...getUserIds(req),
      })) as never,
    );
    await documento.save();
  }
  reply.send(documento);
}

export default {
  createUsers,
  updateUser,
};
