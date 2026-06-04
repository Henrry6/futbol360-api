import "fastify";
import "@fastify/jwt";

import { FastifyReply, FastifyRequest } from "fastify";

export interface JwtUser {
  id: string;
  username: string;
  role: string;
  company?: string;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }

  interface FastifyRequest {
    user: JwtUser;
  }
}
