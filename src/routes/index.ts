import { FastifyInstance } from "fastify";
import { authorize } from "@/plugins/auth";
import { roundsRoutes } from "@/modules/rounds/routes";
import { matchesRoutes } from "@/modules/matchs/routes";
import { authRoutes } from "../modules/auth/auth.routes";
import { authUser } from "@/modules/auth/auth.controller";
import { userRoutes } from "../modules/users/users.routes";
import { teamsRoutes } from "@/modules/teams/team.routes";
import cotroller from "@/modules/leagues/leagues.controller";
import { playersRoutes } from "@/modules/players/player.routes";
import { leagueRoutes } from "../modules/leagues/leagues.routes";
import { categoryRoutes } from "@/modules/categories/category.routes";
import { matchReportRoutes } from "@/modules/matchReports/matchReport.routes";
import { matchEventRoutes } from "@/modules/matchEvents/matchEvent.routes";
import { championsRoutes } from "@/modules/championships/championship.routes";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes, {
    prefix: "/auth",
  });

  await app.register(async (leagueApp) => {
    leagueApp.addHook("preHandler", leagueApp.authenticate);
    leagueApp.addHook("preHandler", authorize(["master", "admin"]));

    await leagueApp.register(leagueRoutes, {
      prefix: "/leagues",
    });
  });

  await app.register(async (instance) => {
    instance.addHook("preHandler", instance.authenticate);
    instance.get("/dashboard", cotroller.getDashboard);
    instance.get("/users/me", authUser.get);
    await instance.register(userRoutes, {
      prefix: "/users",
    });
    await instance.register(championsRoutes, {
      prefix: "/championships",
    });
    await instance.register(categoryRoutes, {
      prefix: "/categories",
    });
    await instance.register(teamsRoutes, {
      prefix: "/teams",
    });
    await instance.register(playersRoutes, {
      prefix: "/players",
    });
    await instance.register(roundsRoutes, {
      prefix: "/rounds",
    });
    await instance.register(matchesRoutes, {
      prefix: "/matchs",
    });
    await instance.register(matchReportRoutes, {
      prefix: "/matchs-reports",
    });
    await instance.register(matchEventRoutes, {
      prefix: "/matchs-events",
    });
  });
}
