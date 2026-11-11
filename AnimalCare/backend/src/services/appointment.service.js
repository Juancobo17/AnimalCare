// Acceso a datos de las citas (AN-13, AN-14, AN-15, AN-16, AN-17).
const prisma = require("../prisma");
const { toDateString, toTimeOfDay, addDays } = require("../utils/schedule");

// Datos que se cargan siempre junto con la cita para poder mostrarla
// sin hacer consultas extra desde el frontend.
const APPOINTMENT_INCLUDE = {
  client: { select: { id: true, name: true, email: true } },
  service: { select: { id: true, name: true, price: true, durationMinutes: true } },
  pet: { select: { id: true, name: true, species: true } },
  review: { select: { rating: true, comment: true } },
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

// Filtros opcionales del listado: un dia concreto (AN-17) y un estado.
function filtros({ date, status } = {}) {
  const where = {};
  if (date) {
    where.scheduledAt = { gte: date, lt: addDays(date, 1) };
  }
  if (status) {
    where.status = status;
  }
  return where;
}

// Citas que agendo un cliente, de la mas proxima a la mas lejana.
async function findAppointmentsByClient(clientId, opciones) {
  return prisma.appointment.findMany({
    where: { clientId, ...filtros(opciones) },
    include: APPOINTMENT_INCLUDE,
    orderBy: { scheduledAt: "asc" },
  });
}

// Agenda de un veterinario.
async function findAppointmentsByVet(vetProfileId, opciones) {
  return prisma.appointment.findMany({
    where: { vetProfileId, ...filtros(opciones) },
    include: APPOINTMENT_INCLUDE,
    orderBy: { scheduledAt: "asc" },
  });
}

async function findAppointmentById(id) {
  return prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE });
}

// Cambia la cita solo si sigue en uno de los estados esperados (evita pisar
// un cambio hecho al mismo tiempo por la otra persona). null si ya cambio.
async function updateIfStatus(id, statuses, data) {
  const resultado = await prisma.appointment.updateMany({
    where: { id, status: { in: statuses } },
    data,
  });
  if (resultado.count === 0) {
    return null;
  }
  return prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE });
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
    pet: appointment.pet
      ? { id: appointment.pet.id, name: appointment.pet.name, species: appointment.pet.species }
      : null,
    review: appointment.review ? { rating: appointment.review.rating, comment: appointment.review.comment } : null,
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
  findAppointmentById,
  updateIfStatus,
  toPublicAppointment,
};
