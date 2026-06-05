import { FastifyReply, FastifyRequest } from "fastify";

export interface JwtUser {
  user: Types.ObjectId;
  username: string;
  role: string;
  league: Types.ObjectId;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }

  interface FastifyRequest {
    payload: JwtUser;
  }
}
