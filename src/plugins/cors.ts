import cors from "@fastify/cors";
import { FastifyInstance } from "fastify";

export async function registerCors(app: FastifyInstance) {
  await app.register(cors, {
    origin: true,
    // @fastify/cors v10+ solo permite GET, HEAD y POST por defecto: sin esta
    // lista el navegador bloquea los PUT/DELETE de la app (preflight CORS).
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
}
