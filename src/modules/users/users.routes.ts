import Users from "./users.service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import cotroller from "@/modules/users/users.controller";

export async function userRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Users, exclude: ["postOne"] });
    app.post("", cotroller.createUsers);
  });
}
