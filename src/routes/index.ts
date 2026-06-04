import { FastifyInstance } from "fastify";
import { authRoutes } from "../modules/auth/auth.routes";
import { userRoutes } from "../modules/users/users.routes";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes, {
    prefix: "/auth",
  });

  await app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", protectedApp.authenticate);

    await protectedApp.register(userRoutes, {
      prefix: "/users",
    });

    // await protectedApp.register(leagueRoutes, {
    //   prefix: "/leagues",
    // });

    // await protectedApp.register(dashboardRoutes, {
    //   prefix: "/dashboard",
    // });
  });
}
