import { buildApp } from "./app";
import { env } from "./config/env";
// import { seedMaster } from "./seed";
import { connectDatabase } from "./config/database";

async function bootstrap() {
  await connectDatabase();
  // await seedMaster();
  const app = await buildApp();

  await app.listen({
    port: env.port,
    host: "0.0.0.0",
  });

  console.log(`Servidor iniciado en puerto http://localhost:${env.port}`);
}

bootstrap();
