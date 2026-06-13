import { sendMail } from "@/libs/utils";

export async function sendWelcomeEmail(email: string, name: string) {
  await sendMail({
    to: email,
    subject: "Bienvenido",
    html: `
      <h1>Hola ${name}</h1>
      <p>Tu cuenta fue creada correctamente.</p>
    `,
  });
}

export function welcomeEmailTemplate({
  name,
  username,
  password,
}: {
  name: string;
  username: string;
  password: string;
}) {
  return `
  <div
    style="
      max-width: 600px;
      margin: auto;
    "
  >               
    <div
        style="
          background: rgba(255,255,255,0.92);
          padding: 40px;
          border: 1px solid #d9d9d9;
          border-radius: 16px;
          font-family: Arial, Helvetica, sans-serif;
          color: #222;
        "
      >
        <h1
        style="
          font-size: 26px;
          margin-bottom: 24px;
          color: #51ad73;
          text-align: center;
        "
      >
        ⚽ ¡Bienvenido a Futbol360! ⚽
      </h1>

        <p style="font-size: 18px; ">
          Hola <strong>${name}</strong>,
        </p>

        <p style="font-size: 18px;">
          Tu cuenta ha sido creada correctamente.
        </p>

        <div
          style="
            background: #f5f7fa;
            border: 1px solid #d9d9d9;
            padding: 15px;
            border-radius: 10px;
            margin: 30px 0;
          "
        >
          <p style="font-size: 19px;">
            <strong>Usuario:</strong> ${username}
          </p>

          <p style="font-size: 19px;">
            <strong>Contraseña:</strong> ${password}
          </p>
        </div>

        <p style="font-size: 18px; ">
          Por seguridad te recomendamos cambiar tu contraseña
          después de iniciar sesión.
        </p>

        <p
          style="
            margin-top: 40px;
            font-size: 18px;
          "
        >
          Saludos,<br />
          <strong>Equipo de administración.</strong>
        </p>
    </div>
  </div>
  `;
}

export function resetPasswordEmailTemplate({
  name,
  resetUrl,
}: {
  name: string;
  resetUrl: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2>Recuperación de contraseña</h2>

      <p>Hola <strong>${name}</strong>,</p>

      <p>
        Hemos recibido una solicitud para restablecer tu contraseña.
      </p>

      <p>
        Haz clic en el siguiente botón:
      </p>

      <p style="margin: 30px 0;">
        <a
          href="${resetUrl}"
          style="
            background: #1677ff;
            color: white;
            text-decoration: none;
            padding: 12px 20px;
            border-radius: 6px;
          "
        >
          Restablecer contraseña
        </a>
      </p>

      <p>
        Si no solicitaste este cambio, puedes ignorar este correo.
      </p>

      <p>
        Este enlace expirará en 30 minutos.
      </p>

      <p>Saludos,<br />Equipo de Administración</p>
    </div>
  `;
}
