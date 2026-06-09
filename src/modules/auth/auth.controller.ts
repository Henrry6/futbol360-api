import { comparePassword } from "@/libs/utils";
import Users from "@/modules/users/users.service";
import { FastifyReply, FastifyRequest } from "fastify";
import Leagues from "@/modules/leagues/leagues.service";

export async function loginController(
  request: FastifyRequest<{
    Body: {
      username: string;
      password: string;
    };
  }>,
  reply: FastifyReply,
) {
  const user = await Users.findOne({
    username: request.body.username,
  }).select("+password");

  if (!user) {
    throw new Error("Usuario o contraseña incorrectos");
  }
  const isValid = await comparePassword(request.body.password, user.password);
  if (!isValid) {
    throw new Error("Usuario o contraseña incorrectos");
  }

  const token = await request.server.jwt.sign({
    user: user._id,
    league: user._id,
    username: user.username,
    role: user.role,
  });

  reply.send({
    token,
    user: {
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      leagues: user.leagues,
    },
  });
}

export const authUser = {
  get: async (request: FastifyRequest, reply: FastifyReply) => {
    console.log(request.payload, "REQQQQ");
    const business = request.payload.league;
    const [user, liga] = await Promise.all([
      Users.findOne(
        { business, _id: request.payload.user },
        "name role leagues",
      ),
      Leagues.findOne({ _id: business }, "name code logo status"),
    ]);
    reply.send({
      code: liga?.code,
      liga: liga?.name,
      status: liga?.status,
      logo: liga?.logo,
      user: {
        name: user?.name,
        role: user?.role,
        leagues: user?.leagues,
      },
    });
  },
};
