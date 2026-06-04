import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";

export default fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET!,
  });
});
