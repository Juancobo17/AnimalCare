// Acceso a datos de las citas (AN-13).
const prisma = require("../prisma");
const { toDateString, toTimeOfDay } = require("../utils/schedule");

// Datos que se cargan siempre junto con la cita para poder mostrarla
// sin hacer consultas extra desde el frontend.
const APPOINTMENT_INCLUDE = {
  client: { select: { id: true, name: true, email: true } },
  service: { select: { id: true, name: true, price: true, durationMinutes: true } },
  vetProfile: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
};

async function createAppointment(data) {
  return prisma.appointment.create({
    data,
    include: APPOINTMENT_INCLUDE,
  });
}

// Citas que agendo un cliente, de la mas proxima a la mas lejana.
async function findAppointmentsByClient(clientId) {
  return prisma.appointment.findMany({
    where: { clientId },
    include: APPOINTMENT_INCLUDE,
    orderBy: { scheduledAt: "asc" },
  });
}

// Agenda de un veterinario.
async function findAppointmentsByVet(vetProfileId) {
  return prisma.appointment.findMany({
    where: { vetProfileId },
    include: APPOINTMENT_INCLUDE,
    orderBy: { scheduledAt: "asc" },
  });
}

// Formato de cita que se envia al frontend.
// La fecha y la hora se separan porque es como las muestra y las envia
// la pantalla de agendamiento.
function toPublicAppointment(appointment) {
  return {
    id: appointment.id,
    mode: appointment.mode,
    date: toDateString(appointment.scheduledAt),
    time: toTimeOfDay(appointment.scheduledAt),
    durationMinutes: appointment.durationMinutes,
    address: appointment.address,
    notes: appointment.notes,
    status: appointment.status,
    createdAt: appointment.createdAt,
    client: appointment.client
      ? { id: appointment.client.id, name: appointment.client.name, email: appointment.client.email }
      : null,
    vet: appointment.vetProfile
      ? {
          id: appointment.vetProfile.id,
          name: appointment.vetProfile.user.name,
          specialty: appointment.vetProfile.specialty,
          address: appointment.vetProfile.address,
          phone: appointment.vetProfile.phone,
        }
      : null,
    service: appointment.service
      ? {
          id: appointment.service.id,
          name: appointment.service.name,
          price: Number(appointment.service.price),
          durationMinutes: appointment.service.durationMinutes,
        }
      : null,
  };
}

module.exports = {
  createAppointment,
  findAppointmentsByClient,
  findAppointmentsByVet,
  toPublicAppointment,
};
