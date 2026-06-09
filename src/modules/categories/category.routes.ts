import UpRouter from "@/libs/UpRouter";
import { FastifyInstance } from "fastify";
import Categories from "./category.service";

export async function categoryRoutes(app: FastifyInstance) {
  app.register(async (app) => {
    app.register(UpRouter, { Model: Categories });
  });
}
