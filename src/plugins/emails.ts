import fp from "fastify-plugin";
import nodemailer from "nodemailer";
import { FastifyInstance } from "fastify";
import { setMailer } from "./mailer-instance";

declare module "fastify" {
  interface FastifyInstance {
    mailer: {
      send: (options: SendMailOptions) => Promise<void>;
    };
  }
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export default fp(async (app: FastifyInstance) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.verify();

    console.log("SMTP conectado correctamente");

    app.decorate("mailer", {
      async send(options: SendMailOptions) {
        await transporter.sendMail({
          from: options.from ?? `"Futbol360" <${process.env.SMTP_FROM}>`,
          ...options,
        });
      },
    });

    // Guardamos una referencia global
    setMailer(app.mailer);
  } catch (e) {
    console.log(e);
  }
});
