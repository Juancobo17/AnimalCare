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

// Solo los veterinarios aprobados por el administrador son publicos (AN-35).
// Un perfil PENDING, SUSPENDED o REJECTED no aparece en el buscador, no
// muestra su perfil y no se puede agendar con el (AN-28 criterio 2, AN-37).
const VISIBLE_VET = { user: { status: "ACTIVE" } };

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
// q busca a la vez por nombre del profesional, especialidad o nombre de un
// servicio activo (AN-27). MySQL compara sin distinguir mayusculas.
// mode permite ver solo quienes atienden a domicilio (AN-10)
// o solo quienes atienden en veterinaria (AN-11).
// zone busca en la direccion del consultorio (barrio, ciudad...).
// maxPrice deja solo a quienes tienen al menos un servicio de ese valor o menos.
async function findVets({ q, specialty, mode, zone, maxPrice } = {}) {
  const where = { ...VISIBLE_VET };
  const condiciones = [];

  if (q) {
    condiciones.push({
      OR: [
        { user: { name: { contains: q } } },
        { specialty: { contains: q } },
        { services: { some: { active: true, name: { contains: q } } } },
      ],
    });
  }
  if (zone) {
    condiciones.push({ address: { contains: zone } });
  }
  if (maxPrice) {
    condiciones.push({ services: { some: { active: true, price: { lte: maxPrice } } } });
  }
  if (condiciones.length > 0) {
    where.AND = condiciones;
  }
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
      availabilities: true,
      _count: { select: { reviews: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

// Citas activas y bloqueos de varios veterinarios en un rango, agrupados por
// veterinario. Dos consultas en total, sin importar cuantos veterinarios sean.
async function findBusyByVet(vetProfileIds, from, to) {
  const porVet = new Map(vetProfileIds.map((id) => [id, []]));
  if (vetProfileIds.length === 0) return porVet;

  const [citas, bloqueos] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        vetProfileId: { in: vetProfileIds },
        status: { in: BUSY_STATUSES },
        scheduledAt: { gte: new Date(from.getTime() - MAX_DURATION_MINUTES * 60 * 1000), lt: to },
      },
      select: { vetProfileId: true, scheduledAt: true, durationMinutes: true },
    }),
    prisma.scheduleBlock.findMany({
      where: { vetProfileId: { in: vetProfileIds }, startsAt: { lt: to }, endsAt: { gt: from } },
      select: { vetProfileId: true, startsAt: true, endsAt: true },
    }),
  ]);

  for (const cita of citas) {
    porVet.get(cita.vetProfileId).push({
      start: cita.scheduledAt,
      end: new Date(cita.scheduledAt.getTime() + cita.durationMinutes * 60 * 1000),
    });
  }
  for (const bloqueo of bloqueos) {
    porVet.get(bloqueo.vetProfileId).push({ start: bloqueo.startsAt, end: bloqueo.endsAt });
  }
  return porVet;
}

const DIA_MS = 24 * 60 * 60 * 1000;

// Medianoche UTC de hoy.
function todayStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Horarios libres de los proximos `dias` dias: [{ date, slots: ["09:00", ...] }].
function slotsByDay(vetProfile, busy, { dias, durationMinutes = DEFAULT_DURATION_MINUTES, now = new Date() }) {
  const inicio = todayStart(now);
  const resultado = [];
  for (let i = 0; i < dias; i += 1) {
    const dia = new Date(inicio.getTime() + i * DIA_MS);
    const slots = buildSlots({
      availabilities: vetProfile.availabilities || [],
      date: dia,
      durationMinutes,
      busy,
      now,
    });
    resultado.push({ date: dia.toISOString().slice(0, 10), slots });
  }
  return resultado;
}

// Primer horario libre dentro de los proximos `dias` dias, o null.
function firstFreeSlot(vetProfile, busy, opciones) {
  const dias = slotsByDay(vetProfile, busy, opciones);
  const dia = dias.find((d) => d.slots.length > 0);
  return dia ? { date: dia.date, time: dia.slots[0] } : null;
}

// Perfil completo de un veterinario, con sus servicios y su horario semanal.
// Devuelve null si no existe o si no esta ACTIVE: para el cliente es lo mismo.
async function findVetById(vetProfileId) {
  return prisma.vetProfile.findFirst({
    where: { id: vetProfileId, ...VISIBLE_VET },
    include: {
      user: { select: { id: true, name: true, email: true } },
      services: ACTIVE_SERVICES,
      availabilities: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { client: { select: { name: true } } },
      },
      _count: { select: { reviews: true } },
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

  // AN-31: los bloqueos excepcionales tambien ocupan la agenda.
  const blocks = await prisma.scheduleBlock.findMany({
    where: { vetProfileId, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
    select: { startsAt: true, endsAt: true },
  });

  return [
    ...appointments.map((appointment) => ({
      start: appointment.scheduledAt,
      end: new Date(appointment.scheduledAt.getTime() + appointment.durationMinutes * 60 * 1000),
    })),
    ...blocks.map((block) => ({ start: block.startsAt, end: block.endsAt })),
  ];
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
// excludeAppointmentId: al reprogramar (AN-16), la cita que se mueve no
// cuenta como ocupada.
async function isSlotFree(vetProfileId, start, durationMinutes, excludeAppointmentId = null) {
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
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: { scheduledAt: true, durationMinutes: true },
  });

  const chocaConCita = citas.some((cita) => {
    const citaFin = new Date(cita.scheduledAt.getTime() + cita.durationMinutes * 60 * 1000);
    return citaFin > start;
  });
  if (chocaConCita) {
    return false;
  }

  // AN-31: tampoco puede caer dentro de un bloqueo.
  const bloqueo = await prisma.scheduleBlock.findFirst({
    where: { vetProfileId, startsAt: { lt: end }, endsAt: { gt: start } },
    select: { id: true },
  });
  return !bloqueo;
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
    photoUrl: vetProfile.photoUrl,
    // Promedio de calificacion (0 a 5). null = aun sin calificaciones.
    rating: vetProfile.rating === null || vetProfile.rating === undefined ? null : Number(vetProfile.rating),
    homeService: vetProfile.homeService,
    clinicService: vetProfile.clinicService,
    address: vetProfile.address,
    totalServices: vetProfile.services ? vetProfile.services.length : 0,
    reviewsCount: vetProfile._count ? vetProfile._count.reviews : undefined,
    // Precio mas bajo de sus servicios, para mostrar "Desde $X" en el listado.
    minPrice:
      vetProfile.services && vetProfile.services.length > 0
        ? Math.min(...vetProfile.services.map((service) => Number(service.price)))
        : null,
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
    // Ultimas resenas. Del cliente solo se muestra el primer nombre.
    reviews: (vetProfile.reviews || []).map((review) => ({
      rating: review.rating,
      comment: review.comment,
      author: review.client.name.split(" ")[0],
      createdAt: review.createdAt,
    })),
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
  findBusyByVet,
  slotsByDay,
  firstFreeSlot,
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
