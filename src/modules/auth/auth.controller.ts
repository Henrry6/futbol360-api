import { FastifyRequest } from "fastify";
import { comparePassword } from "@/libs/utils";
import Users from "@/modules/users/users.service";

export async function loginController(
  request: FastifyRequest<{
    Body: {
      username: string;
      password: string;
    };
  }>,
) {
  const user = await Users.findOne({
    username: request.body.username,
    active: true,
  }).select("+password");

  if (!user) {
    throw new Error("Usuario o contraseña incorrectos");
  }
  const isValid = await comparePassword(request.body.password, user.password);
  if (!isValid) {
    throw new Error("Usuario o contraseña incorrectos");
  }

  const token = await request.server.jwt.sign({
    id: user._id,
    username: user.username,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      leagues: user.leagues,
    },
  };
}
