import Users from "./users.service";
import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import cotroller from "@/modules/users/users.controller";

export async function userRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    // Todas las operaciones respetan el alcance de usuarios (users.scope.ts):
    // sesión de liga → esa liga; admin → sus ligas; master → todos.
    app.register(UpRouter, {
      Model: Users,
      exclude: ["postOne", "putOne"],
      controllers: {
        get: cotroller.listUsers as any,
        getOne: cotroller.getUser as any,
        delOne: cotroller.deleteUser as any,
      },
    });
    app.post("", cotroller.createUsers);
    app.put("/:id", cotroller.updateUser);
  });
}
