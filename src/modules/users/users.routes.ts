import Users from "./users.service";
import { FastifyInstance } from "fastify";
import { createCrudRoutes } from "@/utils/UpRouter";

export async function userRoutes(app: FastifyInstance) {
  createCrudRoutes(app, Users);
}
