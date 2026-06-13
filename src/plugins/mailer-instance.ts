import { FastifyInstance } from "fastify";

let mailer: FastifyInstance["mailer"];

export function setMailer(instance: FastifyInstance["mailer"]) {
  mailer = instance;
}

export function getMailer() {
  if (!mailer) {
    throw new Error("Mailer no inicializado");
  }

  return mailer;
}
