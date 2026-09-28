// Acceso a datos de los veterinarios: listado, perfil detallado (AN-26)
// y calculo de horarios disponibles (AN-13).
const prisma = require("../prisma");
const { buildSlots, DEFAULT_DURATION_MINUTES, MAX_DURATION_MINUTES } = require("../utils/schedule");

// Solo se muestran los servicios activos: un servicio dado de baja
// sigue en la base por historial, pero ya no se ofrece.
const ACTIVE_SERVICES = {
  where: { active: true },
  orderBy: { name: "asc" },
};

// Citas que ocupan la agenda. Una cita cancelada libera el horario.
const BUSY_STATUSES = ["PENDING", "CONFIRMED"];

// Modalidades de atencion que existen en el sistema (AN-10 y AN-11).
const MODOS_VALIDOS = ["HOME", "CLINIC"];

// Comprueba que el veterinario ofrezca la modalidad pedida.
// Devuelve el mensaje de error, o null si la modalidad es correcta.
function validateMode(vetProfile, mode) {
  if (mode === "HOME" && !vetProfile.homeService) {
    return "Este veterinario no ofrece atencion a domicilio.";
  }
  if (mode === "CLINIC" && !vetProfile.clinicService) {
    return "Este veterinario no ofrece atencion en la veterinaria.";
  }
  return null;
}

// Lista los veterinarios disponibles, con filtros opcionales.
// mode permite ver solo quienes atienden a domicilio (AN-10)
// o solo quienes atienden en veterinaria (AN-11).
async function findVets({ specialty, mode } = {}) {
  const where = {};

  if (specialty) {
    where.specialty = { contains: specialty };
  }
  if (mode === "HOME") {
    where.homeService = true;
  }
  if (mode === "CLINIC") {
    where.clinicService = true;
  }

  return prisma.vetProfile.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      services: ACTIVE_SERVICES,
    },
    orderBy: { createdAt: "asc" },
  });
}

// Perfil completo de un veterinario, con sus servicios y su horario semanal.
async function findVetById(vetProfileId) {
  return prisma.vetProfile.findUnique({
    where: { id: vetProfileId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      services: ACTIVE_SERVICES,
      availabilities: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
    },
  });
}

// Busca un servicio activo dentro del catalogo de un veterinario.
// Devuelve null si el servicio no existe o es de otro profesional.
async function findServiceOfVet(vetProfileId, serviceId) {
  return prisma.service.findFirst({
    where: { id: serviceId, vetProfileId, active: true },
  });
}

// Devuelve los rangos ocupados de un veterinario dentro de un dia.
// Se consulta desde la medianoche del dia hasta la del dia siguiente.
async function findBusyIntervals(vetProfileId, date) {
  const dayStart = date;
  const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      vetProfileId,
      status: { in: BUSY_STATUSES },
      scheduledAt: { gte: dayStart, lt: dayEnd },
    },
    select: { scheduledAt: true, durationMinutes: true },
  });

  return appointments.map((appointment) => ({
    start: appointment.scheduledAt,
    end: new Date(appointment.scheduledAt.getTime() + appointment.durationMinutes * 60 * 1000),
  }));
}

// Horarios que el veterinario atiende ese dia segun su horario semanal,
// SIN descontar las citas ya tomadas. Sirve para distinguir dos casos que el
// cliente vive distinto: "no atiendo a esa hora" y "esa hora ya esta ocupada".
function buildScheduleSlots(vetProfile, date, durationMinutes = DEFAULT_DURATION_MINUTES) {
  return buildSlots({
    availabilities: vetProfile.availabilities || [],
    date,
    durationMinutes,
    busy: [],
    // Fecha muy antigua para que no se descarte ningun bloque por ser pasado:
    // aqui solo interesa el horario de atencion.
    now: new Date(0),
  });
}

// Horarios libres de un veterinario para un dia y una duracion determinados.
async function findAvailableSlots(vetProfile, date, durationMinutes = DEFAULT_DURATION_MINUTES) {
  const availabilities = vetProfile.availabilities
    ? vetProfile.availabilities
    : await prisma.availability.findMany({ where: { vetProfileId: vetProfile.id } });

  const busy = await findBusyIntervals(vetProfile.id, date);

  return buildSlots({ availabilities, date, durationMinutes, busy });
}

// Comprueba si un horario concreto sigue libre.
// Se usa justo antes de guardar la cita, para que dos clientes no tomen
// el mismo horario entre que se carga la pantalla y se confirma.
async function isSlotFree(vetProfileId, start, durationMinutes) {
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  // Una cita anterior solo puede estorbar si empezo, como maximo,
  // la duracion mas larga posible antes del nuevo horario.
  const ventanaInicio = new Date(start.getTime() - MAX_DURATION_MINUTES * 60 * 1000);

  // La base filtra por hora de inicio; el fin se calcula aqui porque
  // depende de la duracion guardada en cada fila.
  const citas = await prisma.appointment.findMany({
    where: {
      vetProfileId,
      status: { in: BUSY_STATUSES },
      scheduledAt: { gte: ventanaInicio, lt: end },
    },
    select: { scheduledAt: true, durationMinutes: true },
  });

  return !citas.some((cita) => {
    const citaFin = new Date(cita.scheduledAt.getTime() + cita.durationMinutes * 60 * 1000);
    return citaFin > start;
  });
}

// Formato de servicio que se envia al frontend.
// price es Decimal en Prisma y en JSON saldria como texto: se pasa a numero.
function toPublicService(service) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    price: Number(service.price),
    durationMinutes: service.durationMinutes,
  };
}

// Resumen del veterinario para el listado.
function toPublicVetSummary(vetProfile) {
  return {
    id: vetProfile.id,
    userId: vetProfile.user.id,
    name: vetProfile.user.name,
    specialty: vetProfile.specialty,
    homeService: vetProfile.homeService,
    clinicService: vetProfile.clinicService,
    address: vetProfile.address,
    totalServices: vetProfile.services ? vetProfile.services.length : 0,
  };
}

// Perfil detallado del veterinario (AN-26).
function toPublicVetDetail(vetProfile) {
  return {
    ...toPublicVetSummary(vetProfile),
    email: vetProfile.user.email,
    license: vetProfile.license,
    bio: vetProfile.bio,
    phone: vetProfile.phone,
    services: (vetProfile.services || []).map(toPublicService),
    availabilities: (vetProfile.availabilities || []).map((item) => ({
      weekday: item.weekday,
      startTime: item.startTime,
      endTime: item.endTime,
    })),
  };
}

module.exports = {
  findVets,
  findVetById,
  findServiceOfVet,
  findBusyIntervals,
  buildScheduleSlots,
  findAvailableSlots,
  isSlotFree,
  toPublicService,
  toPublicVetSummary,
  toPublicVetDetail,
  validateMode,
  MODOS_VALIDOS,
  BUSY_STATUSES,
};
