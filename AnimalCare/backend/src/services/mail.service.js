// Envio de correos: recuperacion de contrasena y verificacion del correo.
//
// MAIL_TRANSPORT=console (por defecto): el correo se imprime en la consola del
// servidor. Sirve para desarrollo y para las pruebas automaticas.
// MAIL_TRANSPORT=smtp: se envia de verdad con SMTP_URL (por ejemplo
// smtps://usuario:clave@smtp.gmail.com:465) y MAIL_FROM.
const fs = require("node:fs");
const nodemailer = require("nodemailer");

const TRANSPORT = process.env.MAIL_TRANSPORT || "console";
const FROM = process.env.MAIL_FROM || "AnimalCare <no-reply@animalcare.local>";

let transporter = null;
function getTransporter() {
  if (!transporter) {
    if (TRANSPORT === "smtp") {
      if (!process.env.SMTP_URL) {
        throw new Error("MAIL_TRANSPORT=smtp requiere SMTP_URL.");
      }
      transporter = nodemailer.createTransport(process.env.SMTP_URL);
    } else {
      transporter = nodemailer.createTransport({ jsonTransport: true });
    }
  }
  return transporter;
}

// Ultimo correo "enviado" por consola. Las pruebas lo leen desde aqui.
const enviados = [];

async function sendMail({ to, subject, text, html }) {
  const info = await getTransporter().sendMail({ from: FROM, to, subject, text, html });
  if (TRANSPORT !== "smtp") {
    enviados.push({ to, subject, text });
    if (enviados.length > 50) enviados.shift();
    console.log(`\n[correo para ${to}] ${subject}\n${text}\n`);
    // MAIL_OUTBOX_FILE: las pruebas automaticas leen aqui los enlaces enviados.
    if (process.env.MAIL_OUTBOX_FILE) {
      fs.appendFileSync(process.env.MAIL_OUTBOX_FILE, JSON.stringify({ to, subject, text, at: Date.now() }) + "\n");
    }
  }
  return info;
}

// Plantilla simple con el enlace de accion.
function plantilla({ titulo, cuerpo, enlace, textoBoton }) {
  const text = `${titulo}\n\n${cuerpo}\n\n${textoBoton}: ${enlace}\n\nSi no fuiste tú, ignora este mensaje.`;
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2a37">
      <h2 style="color:#1c6742">${titulo}</h2>
      <p>${cuerpo}</p>
      <p style="margin:24px 0">
        <a href="${enlace}" style="background:#258355;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">${textoBoton}</a>
      </p>
      <p style="color:#6b7280;font-size:13px">Si el botón no funciona, copia este enlace: ${enlace}<br>Si no fuiste tú, ignora este mensaje.</p>
    </div>`;
  return { text, html };
}

module.exports = { sendMail, plantilla, enviados };
