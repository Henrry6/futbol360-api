import Debug from "debug";
import Users from "@/modules/users/users.service";
import { FastifyReply, FastifyRequest } from "fastify";
import Leagues from "@/modules/leagues/leagues.service";
import { comparePassword, FastifyError } from "@/libs/utils";

const debug = Debug("src:modules:auth");

export const authUser = {
  postAdmin: async (
    req: FastifyRequest<{
      Body: {
        username: string;
        password: string;
      };
    }>,
    reply: FastifyReply,
  ) => {
    debug("Verificación de login");
    const user = await Users.findOne({
      username: req.body.username,
    }).select("+password");
    if (!user) {
      throw new FastifyError(
        `Usuario ${req.body.username} no fue encontrado`,
        404,
      );
    }
    const isValid = await comparePassword(req.body.password, user.password);
    if (!isValid) {
      throw new Error("Usuario o contraseña incorrectos");
    }
    const token = await req.server.jwt.sign(
      {
        user: user._id,
        username: user.username,
        role: user.role,
      },
      {
        expiresIn: "7d",
      },
    );

    reply.send({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
      },
    });
  },
  postLogin: async (
    req: FastifyRequest<{
      Body: {
        code: string;
        username: string;
        password: string;
      };
    }>,
    reply: FastifyReply,
  ) => {
    debug("Verificación de login");
    const user = await Users.findOne({
      username: req.body.username,
    }).select("+password");

    const liga = await Leagues.findOne({ code: req.body.code }, "name code");
    if (!liga) {
      throw new FastifyError(`Liga ${req.body.code} no fue encontrada`, 404);
    }
    if (!user) {
      throw new FastifyError(
        `Usuario ${req.body.username} no fue encontrado`,
        404,
      );
    }
    const isValid = await comparePassword(req.body.password, user.password);
    if (!isValid) {
      throw new Error("Usuario o contraseña incorrectos");
    }
    const token = await req.server.jwt.sign(
      {
        user: user._id,
        league: liga._id,
        username: user.username,
        role: user.role,
      },
      {
        expiresIn: "7d",
      },
    );

    reply.send({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        leagues: user.leagues,
      },
    });
  },
  get: async (request: FastifyRequest, reply: FastifyReply) => {
    debug("Obteniendo usuario logueado");
    const leagues = request.payload.league;
    const [user, liga] = await Promise.all([
      Users.findOne(
        { leagues, _id: request.payload.user },
        "name role leagues",
      ),
      Leagues.findOne({ _id: leagues }, "name code logo status"),
    ]);
    if (!user) {
      return reply.status(404).send({ message: "Usuario no encontrado" });
    }
    if (!liga) {
      return reply.status(404).send({ message: "Liga no encontrada" });
    }
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
