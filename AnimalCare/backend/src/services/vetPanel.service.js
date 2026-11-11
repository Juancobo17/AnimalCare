// Acceso a datos del panel del veterinario:
// sus servicios (AN-28, AN-29, AN-30), su horario base y sus bloqueos (AN-31).
const prisma = require("../prisma");
const { MAX_DURATION_MINUTES, toDateString, toTimeOfDay, describeDateTime } = require("../utils/schedule");
const notificationService = require("./notification.service");
const { BUSY_STATUSES } = require("./vet.service");

// ---------- Servicios ----------

async function findActiveServices(vetProfileId) {
  return prisma.service.findMany({
    where: { vetProfileId, active: true },
    orderBy: { name: "asc" },
  });
}

// Servicio activo que pertenezca a ese veterinario. null si no.
async function findOwnService(vetProfileId, serviceId) {
  return prisma.service.findFirst({ where: { id: serviceId, vetProfileId, active: true } });
}

async function createService(vetProfileId, data) {
  return prisma.service.create({ data: { ...data, vetProfileId } });
}

// AN-30: si el servicio ya se uso en alguna cita, no se modifica la fila:
// se da de baja y se crea una version nueva. Asi las citas anteriores
// conservan el nombre y el precio con que se agendaron.
async function updateService(service, data) {
  const usos = await prisma.appointment.count({ where: { serviceId: service.id } });

  if (usos === 0) {
    return prisma.service.update({ where: { id: service.id }, data });
  }

  return prisma.$transaction(async (tx) => {
    await tx.service.update({ where: { id: service.id }, data: { active: false } });
    return tx.service.create({ data: { ...data, vetProfileId: service.vetProfileId } });
  });
}

// AN-29: baja logica. La fila se conserva para el historial de citas
// (criterio 2), pero ya no aparece en el perfil ni se puede agendar.
async function deactivateService(serviceId) {
  return prisma.service.update({ where: { id: serviceId }, data: { active: false } });
}

// ---------- Horario base ----------

async function findAvailabilities(vetProfileId) {
  return prisma.availability.findMany({
    where: { vetProfileId },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
}

// Reemplaza el horario semanal completo en una sola transaccion.
async function replaceAvailabilities(vetProfileId, franjas) {
  return prisma.$transaction(async (tx) => {
    await tx.availability.deleteMany({ where: { vetProfileId } });
    await tx.availability.createMany({
      data: franjas.map((franja) => ({ ...franja, vetProfileId })),
    });
    return tx.availability.findMany({
      where: { vetProfileId },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    });
  });
}

// ---------- Bloqueos ----------

async function findUpcomingBlocks(vetProfileId) {
  return prisma.scheduleBlock.findMany({
    where: { vetProfileId, endsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
  });
}

async function findOwnBlock(vetProfileId, blockId) {
  return prisma.scheduleBlock.findFirst({ where: { id: blockId, vetProfileId } });
}

async function deleteBlock(blockId) {
  return prisma.scheduleBlock.delete({ where: { id: blockId } });
}

// Citas activas que se cruzan con el rango [startsAt, endsAt).
async function findConflictingAppointments(vetProfileId, startsAt, endsAt) {
  const ventanaInicio = new Date(startsAt.getTime() - MAX_DURATION_MINUTES * 60 * 1000);

  const citas = await prisma.appointment.findMany({
    where: {
      vetProfileId,
      status: { in: BUSY_STATUSES },
      scheduledAt: { gte: ventanaInicio, lt: endsAt },
    },
    include: {
      client: { select: { id: true, name: true, email: true } },
      service: { select: { id: true, name: true, price: true, durationMinutes: true } },
      vetProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return citas.filter((cita) => {
    const fin = new Date(cita.scheduledAt.getTime() + cita.durationMinutes * 60 * 1000);
    return fin > startsAt;
  });
}

// Crea el bloqueo y, si el veterinario lo confirmo, cancela las citas que
// chocan y avisa a cada cliente (AN-31 criterio 4). Todo o nada.
async function createBlockCancelling(vetProfileId, data, citasACancelar, nombreVeterinario) {
  return prisma.$transaction(async (tx) => {
    const bloqueo = await tx.scheduleBlock.create({ data: { ...data, vetProfileId } });

    for (const cita of citasACancelar) {
      const resultado = await tx.appointment.updateMany({
        where: { id: cita.id, status: { in: BUSY_STATUSES } },
        data: { status: "CANCELLED" },
      });
      if (resultado.count > 0) {
        await notificationService.notify(
          cita.clientId,
          `Tu cita del ${describeDateTime(cita.scheduledAt)} ` +
            `con ${nombreVeterinario} fue cancelada porque el veterinario no estará disponible. ` +
            "Puedes agendar otro horario.",
          tx
        );
      }
    }

    return bloqueo;
  });
}

function toPublicBlock(block) {
  return {
    id: block.id,
    date: toDateString(block.startsAt),
    startTime: toTimeOfDay(block.startsAt),
    // Un bloqueo de dia completo termina a las 00:00 del dia siguiente.
    endTime: toTimeOfDay(block.endsAt) === "00:00" ? "24:00" : toTimeOfDay(block.endsAt),
    allDay: block.endsAt.getTime() - block.startsAt.getTime() === 24 * 60 * 60 * 1000
      && toTimeOfDay(block.startsAt) === "00:00",
    reason: block.reason,
  };
}

module.exports = {
  findActiveServices,
  findOwnService,
  createService,
  updateService,
  deactivateService,
  findAvailabilities,
  replaceAvailabilities,
  findUpcomingBlocks,
  findOwnBlock,
  deleteBlock,
  findConflictingAppointments,
  createBlockCancelling,
  toPublicBlock,
};
