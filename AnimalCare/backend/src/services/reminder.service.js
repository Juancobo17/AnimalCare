// Recordatorios automaticos de citas.
//
// Cada cierto tiempo se buscan las citas activas que empiezan en las
// proximas 24 horas y que aun no tienen recordatorio, y se avisa al cliente
// y al veterinario. reminderSentAt evita avisar dos veces.
//
// Los avisos son dentro de la plataforma. Para enviarlos tambien por correo o
// WhatsApp habria que conectar un proveedor (SMTP, Twilio...) en este punto.
const prisma = require("../prisma");
const { describeDateTime } = require("../utils/schedule");

const VENTANA_MS = 24 * 60 * 60 * 1000;

// Devuelve cuantas citas recibieron recordatorio en esta pasada.
// soloDonde permite acotar la pasada (las pruebas la limitan a sus datos).
async function runReminders(now = new Date(), soloDonde = {}) {
  const citas = await prisma.appointment.findMany({
    where: {
      ...soloDonde,
      status: { in: ["PENDING", "CONFIRMED"] },
      reminderSentAt: null,
      scheduledAt: { gt: now, lte: new Date(now.getTime() + VENTANA_MS) },
    },
    include: {
      client: { select: { id: true, name: true } },
      pet: { select: { name: true } },
      vetProfile: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  let enviados = 0;
  for (const cita of citas) {
    // Se marca primero y solo si sigue sin marcar: si dos procesos corren a
    // la vez, solo uno envia el aviso.
    const marcada = await prisma.appointment.updateMany({
      where: { id: cita.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (marcada.count === 0) continue;

    const cuando = describeDateTime(cita.scheduledAt);
    const mascota = cita.pet ? ` con ${cita.pet.name}` : "";
    const lugar = cita.mode === "HOME" ? `a domicilio (${cita.address})` : `en ${cita.vetProfile.address || "la veterinaria"}`;

    await prisma.notification.createMany({
      data: [
        {
          userId: cita.client.id,
          message: `Recordatorio: tienes cita${mascota} con ${cita.vetProfile.user.name} el ${cuando}, ${lugar}.`,
        },
        {
          userId: cita.vetProfile.user.id,
          message: `Recordatorio: cita con ${cita.client.name}${mascota} el ${cuando}.`,
        },
      ],
    });
    enviados += 1;
  }
  return enviados;
}

// Arranca la revision periodica. Devuelve el temporizador para poder detenerlo.
// Se desactiva con REMINDERS_ENABLED=false (por ejemplo, en un servidor de pruebas).
function startReminderJob(intervalMs = Number(process.env.REMINDER_INTERVAL_MS) || 10 * 60 * 1000) {
  if (process.env.REMINDERS_ENABLED === "false") {
    return null;
  }
  const tick = () =>
    runReminders().catch((error) => console.error("Error enviando recordatorios:", error));
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return timer;
}

module.exports = { runReminders, startReminderJob };
