import fp from "fastify-plugin";
import { JwtUser } from "@/types/fastify";
import { FastifyReply, FastifyRequest } from "fastify";

export default fp(async (app) => {
  app.decorate("authenticate", async function (request, reply) {
    try {
      const payload = await request.jwtVerify();
      request.payload = payload as JwtUser;
    } catch (error: any) {
      if (error.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED") {
        return reply.status(401).send({
          message: "La sesión ha expirado",
          code: "TOKEN_EXPIRED",
        });
      }

      return reply.status(401).send({
        message: "Token inválido",
        code: "INVALID_TOKEN",
      });
    }
  });
});

export function authorize(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.payload.role;
    if (!userRole || !roles.includes(userRole)) {
      return reply.status(403).send({
        message: "No tienes permisos para acceder a este recurso",
      });
    }
  };
}
