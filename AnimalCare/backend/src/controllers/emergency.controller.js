// Urgencias (lo que AN-23 llamaba "emergencias").
//
// Flujo:
//   1. No hay turnos aparte: un veterinario recibe urgencias cuando esta dentro de
//      su horario de "Mi horario" y sin un bloqueo de agenda en ese momento.
//   2. El dueño describe la urgencia (sintomas, mascota, telefono y si es en la
//      veterinaria o a domicilio).
//   3. Se avisa a los veterinarios de turno compatibles con la modalidad. El
//      primero que la acepta se queda con ella (la toma es atomica) y se le crea
//      una cita confirmada de URGENCY_MINUTES que ocupa su agenda. Si tenia citas
//      en ese rato, la urgencia tiene prioridad: con su confirmacion esas citas se
//      cancelan y se pide a cada cliente que reagende.
//   4. El dueño ve quien lo atiende y como contactarlo. La urgencia termina
//      cuando el veterinario la marca como atendida, el dueño la cancela, el
//      veterinario la libera (vuelve a abrirse) o vence sin respuesta.
//
// AnimalCare conecta con veterinarios de turno; no garantiza una respuesta.
// Si nadie acepta en EMERGENCY_TTL_MIN minutos, la solicitud vence.
const prisma = require("../prisma");
const notificationService = require("../services/notification.service");
const { findOwnActivePet } = require("./pet.controller");
const { parseId } = require("../utils/params");
const { localWeekday, toTimeOfDay, parseTime, describeDateTime, MAX_DURATION_MINUTES } = require("../utils/schedule");

const TTL_MIN = Number(process.env.EMERGENCY_TTL_MIN) || 30;
const TTL_MS = TTL_MIN * 60 * 1000;
// Lo que dura la cita que se crea al aceptar una urgencia.
const URGENCY_MINUTES = 30;
const MIN_SYMPTOMS = 10;
const MAX_SYMPTOMS = 500;
const MODES = ["CLINIC", "HOME"];
const ACTIVE = ["OPEN", "ACCEPTED"];

function serverError(res, where, error) {
  console.error(`Error en ${where}:`, error);
  return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
}

function badRequest(res, errors) {
  return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
}

// Las solicitudes abiertas que pasaron el limite se cierran como vencidas.
async function expireOld() {
  await prisma.emergencyRequest.updateMany({
    where: { status: "OPEN", createdAt: { lt: new Date(Date.now() - TTL_MS) } },
    data: { status: "EXPIRED", closedAt: new Date() },
  });
}

// Veterinarios que pueden recibir una urgencia ahora mismo: cuenta aprobada,
// modalidad compatible, dentro de su horario semanal para los proximos
// URGENCY_MINUTES, sin bloqueo de agenda y sin otra urgencia en curso.
// Las citas normales no lo impiden: la urgencia tiene prioridad sobre ellas.
async function vetsDisponibles(mode, { excluir } = {}) {
  const where = { user: { status: "ACTIVE" }, emergencies: { none: { status: "ACCEPTED" } } };
  if (mode === "HOME") where.homeService = true;
  if (mode === "CLINIC") where.clinicService = true;
  if (excluir) where.id = { not: excluir };
  const perfiles = await prisma.vetProfile.findMany({ where, include: { availabilities: true } });
  return filtrarPorHorario(perfiles);
}

async function filtrarPorHorario(perfiles) {
  if (perfiles.length === 0) return [];
  const ahora = new Date();
  const fin = new Date(ahora.getTime() + URGENCY_MINUTES * 60000);
  const minutosAhora = parseTime(toTimeOfDay(ahora));
  const diaSemana = localWeekday(ahora);
  const bloqueos = await prisma.scheduleBlock.findMany({
    where: { vetProfileId: { in: perfiles.map((p) => p.id) }, startsAt: { lt: fin }, endsAt: { gt: ahora } },
    select: { vetProfileId: true },
  });
  const bloqueados = new Set(bloqueos.map((b) => b.vetProfileId));

  return perfiles.filter(
    (p) =>
      !bloqueados.has(p.id) &&
      p.availabilities.some(
        (a) =>
          a.weekday === diaSemana &&
          parseTime(a.startTime) <= minutosAhora &&
          minutosAhora + URGENCY_MINUTES <= parseTime(a.endTime)
      )
  );
}

// Citas del veterinario que se cruzan con una urgencia que empieza ahora.
async function citasEnConflicto(vetProfileId, desde) {
  const fin = new Date(desde.getTime() + URGENCY_MINUTES * 60000);
  const citas = await prisma.appointment.findMany({
    where: {
      vetProfileId,
      status: { in: ["PENDING", "CONFIRMED"] },
      scheduledAt: { gte: new Date(desde.getTime() - MAX_DURATION_MINUTES * 60000), lt: fin },
    },
    include: { client: { select: { id: true, name: true } } },
  });
  return citas.filter((c) => new Date(c.scheduledAt.getTime() + c.durationMinutes * 60000) > desde);
}

const INCLUDE = {
  pet: { select: { id: true, name: true, species: true } },
  client: { select: { id: true, name: true } },
  vetProfile: { include: { user: { select: { id: true, name: true } } } },
};

// Lo que ve el dueño de su solicitud.
function toClientView(r) {
  return {
    id: r.id,
    status: r.status,
    symptoms: r.symptoms,
    mode: r.mode,
    address: r.address,
    phone: r.phone,
    createdAt: r.createdAt,
    expiresAt: r.status === "OPEN" ? new Date(r.createdAt.getTime() + TTL_MS) : null,
    acceptedAt: r.acceptedAt,
    closedAt: r.closedAt,
    pet: r.pet,
    // Los datos de contacto del veterinario solo cuando acepto.
    vet: r.vetProfile
      ? {
          name: r.vetProfile.user.name,
          specialty: r.vetProfile.specialty,
          phone: r.vetProfile.phone,
          address: r.mode === "CLINIC" ? r.vetProfile.address : null,
        }
      : null,
  };
}

// Lo que ve el veterinario: incluye el telefono del dueño para contactarlo.
function toVetView(r) {
  return {
    id: r.id,
    status: r.status,
    symptoms: r.symptoms,
    mode: r.mode,
    address: r.address,
    phone: r.phone,
    createdAt: r.createdAt,
    expiresAt: r.status === "OPEN" ? new Date(r.createdAt.getTime() + TTL_MS) : null,
    acceptedAt: r.acceptedAt,
    closedAt: r.closedAt,
    client: { name: r.client.name },
    pet: r.pet,
  };
}

function resumen(texto) {
  return texto.length > 80 ? `${texto.slice(0, 77)}...` : texto;
}

// ======================= Dueño =======================

// GET /api/emergencies/availability
// Cuantos veterinarios estan atendiendo ahora segun su horario, para avisar antes de pedir.
async function availability(req, res) {
  try {
    const lista = await vetsDisponibles(null);
    return res.status(200).json({
      available: lista.length,
      home: lista.filter((p) => p.homeService).length,
      clinic: lista.filter((p) => p.clinicService).length,
      ttlMinutes: TTL_MIN,
    });
  } catch (error) {
    return serverError(res, "emergency availability", error);
  }
}

// POST /api/emergencies  { petId?, symptoms, mode, address?, phone }
async function createEmergency(req, res) {
  try {
    const body = req.body || {};
    const sintomas = String(body.symptoms ?? "").trim();
    const modo = String(body.mode ?? "").trim().toUpperCase();
    const direccion = String(body.address ?? "").trim();
    const telefono = String(body.phone ?? "").trim();
    const errors = [];

    if (sintomas.length < MIN_SYMPTOMS) errors.push(`Describe qué le pasa a tu mascota (mínimo ${MIN_SYMPTOMS} caracteres).`);
    else if (sintomas.length > MAX_SYMPTOMS) errors.push(`La descripción no puede superar los ${MAX_SYMPTOMS} caracteres.`);
    if (!MODES.includes(modo)) errors.push("Elige si la atención es en la veterinaria o a domicilio.");
    if (modo === "HOME" && direccion === "") errors.push("Indica la dirección a la que debe ir el veterinario.");
    if (direccion.length > 150) errors.push("La dirección no puede superar los 150 caracteres.");
    if (!/^[0-9+\s-]{7,15}$/.test(telefono)) errors.push("Escribe un teléfono de contacto válido.");
    if (errors.length > 0) return badRequest(res, errors);

    let pet = null;
    if (body.petId !== undefined && body.petId !== null && String(body.petId).trim() !== "") {
      const petId = parseId(body.petId);
      pet = petId ? await findOwnActivePet(petId, req.user.id) : null;
      if (!pet) return res.status(404).json({ message: "La mascota no existe o no es tuya." });
    }

    await expireOld();

    // Una urgencia a la vez: evita avisar varias veces a los mismos veterinarios.
    const activa = await prisma.emergencyRequest.findFirst({
      where: { clientId: req.user.id, status: { in: ACTIVE } },
      include: INCLUDE,
    });
    if (activa) {
      return res.status(409).json({
        message: "Ya tienes una urgencia en curso. Espera la respuesta o cancélala antes de pedir otra.",
        code: "EMERGENCY_IN_PROGRESS",
        emergency: toClientView(activa),
      });
    }

    const veterinarios = await vetsDisponibles(modo);
    if (veterinarios.length === 0) {
      return res.status(409).json({
        message:
          "No hay veterinarios atendiendo en este momento para esa modalidad. " +
          "Si tu mascota está grave, acude de inmediato a la clínica veterinaria más cercana.",
        code: "NO_VETS_AVAILABLE",
      });
    }

    const creada = await prisma.emergencyRequest.create({
      data: {
        symptoms: sintomas,
        mode: modo,
        address: modo === "HOME" ? direccion : null,
        phone: telefono,
        clientId: req.user.id,
        petId: pet ? pet.id : null,
      },
      include: INCLUDE,
    });

    await notificationService.notifyMany(
      veterinarios.map((v) => v.userId),
      `URGENCIA ${modo === "HOME" ? "a domicilio" : "en la veterinaria"}: ${req.user.name}${pet ? ` (${pet.name}, ${pet.species})` : ""} — ` +
        `${resumen(sintomas)}. Respóndela desde Urgencias.`
    );

    return res.status(201).json({
      message: `Avisamos a ${veterinarios.length} veterinario(s) disponibles. Te mostraremos aquí quién la acepta.`,
      emergency: toClientView(creada),
    });
  } catch (error) {
    return serverError(res, "createEmergency", error);
  }
}

// PATCH /api/emergencies/:id/cancel   (dueño)
async function cancelEmergency(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "El identificador de la urgencia no es valido." });
    await expireOld();

    const actual = await prisma.emergencyRequest.findFirst({
      where: { id, clientId: req.user.id },
      include: INCLUDE,
    });
    if (!actual) return res.status(404).json({ message: "La urgencia no existe." });
    if (!ACTIVE.includes(actual.status)) {
      return res.status(409).json({ message: "Esta urgencia ya está cerrada." });
    }

    const r = await prisma.emergencyRequest.updateMany({
      where: { id, clientId: req.user.id, status: { in: ACTIVE } },
      data: { status: "CANCELLED", closedAt: new Date() },
    });
    if (r.count === 0) return res.status(409).json({ message: "La urgencia cambió de estado. Actualiza la página." });

    await cerrarCita(actual.appointmentId, "CANCELLED");
    if (actual.status === "ACCEPTED" && actual.vetProfile) {
      await notificationService.notify(
        actual.vetProfile.user.id,
        `${actual.client.name} canceló su urgencia: ya no necesita la atención.`
      );
    }
    return res.status(200).json({ message: "Urgencia cancelada." });
  } catch (error) {
    return serverError(res, "cancelEmergency", error);
  }
}

// ======================= Veterinario =======================

// GET /api/emergencies/open
async function listOpen(req, res) {
  try {
    await expireOld();
    const perfil = await prisma.vetProfile.findUnique({ where: { id: req.user.vetProfile.id } });
    const canAttend = req.user.status === "ACTIVE";
    const disponible = canAttend && (await disponibleAhora(perfil));
    if (!disponible) return res.status(200).json({ available: false, canAttend, requests: [] });

    const modos = [];
    if (perfil.clinicService) modos.push("CLINIC");
    if (perfil.homeService) modos.push("HOME");
    const abiertas = await prisma.emergencyRequest.findMany({
      where: { status: "OPEN", mode: { in: modos } },
      include: INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return res.status(200).json({ available: true, canAttend, requests: abiertas.map(toVetView) });
  } catch (error) {
    return serverError(res, "listOpen", error);
  }
}

// GET /api/emergencies/mine
// Dueño: sus ultimas solicitudes. Veterinario: las que acepto.
async function listMine(req, res) {
  try {
    await expireOld();
    if (req.user.role === "CLIENT") {
      const lista = await prisma.emergencyRequest.findMany({
        where: { clientId: req.user.id },
        include: INCLUDE,
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      const vistas = lista.map(toClientView);
      return res.status(200).json({
        active: vistas.find((v) => ACTIVE.includes(v.status)) || null,
        emergencies: vistas,
      });
    }

    const lista = await prisma.emergencyRequest.findMany({
      where: { vetProfileId: req.user.vetProfile.id, status: { in: ["ACCEPTED", "COMPLETED"] } },
      include: INCLUDE,
      orderBy: { acceptedAt: "desc" },
      take: 10,
    });
    const vistas = lista.map(toVetView);
    return res.status(200).json({
      active: vistas.find((v) => v.status === "ACCEPTED") || null,
      emergencies: vistas,
    });
  } catch (error) {
    return serverError(res, "listMine", error);
  }
}

// PATCH /api/emergencies/:id/accept
// La toma es atomica: si dos veterinarios la aceptan a la vez, solo uno la consigue.
async function acceptEmergency(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "El identificador de la urgencia no es valido." });
    await expireOld();

    const perfil = await prisma.vetProfile.findUnique({ where: { id: req.user.vetProfile.id } });
    if (req.user.status !== "ACTIVE") {
      return res.status(409).json({ message: "Tu cuenta debe estar aprobada para atender urgencias." });
    }
    if (!(await disponibleAhora(perfil))) {
      return res.status(409).json({
        message:
          `La urgencia ocupa los próximos ${URGENCY_MINUTES} minutos y deben caer dentro de tu horario ` +
          "de atención, sin un bloqueo de agenda.",
        code: "NOT_AVAILABLE",
      });
    }

    const urgencia = await prisma.emergencyRequest.findUnique({ where: { id } });
    if (!urgencia) return res.status(404).json({ message: "La urgencia no existe." });
    if ((urgencia.mode === "HOME" && !perfil.homeService) || (urgencia.mode === "CLINIC" && !perfil.clinicService)) {
      return res.status(409).json({ message: "Esta urgencia es de una modalidad que no atiendes." });
    }

    const enCurso = await prisma.emergencyRequest.count({
      where: { vetProfileId: perfil.id, status: "ACCEPTED" },
    });
    if (enCurso > 0) {
      return res.status(409).json({ message: "Ya tienes una urgencia en curso. Márcala como atendida antes de aceptar otra." });
    }

    // Las citas de ese rato se cruzan con la urgencia: se pide confirmacion.
    const inicio = new Date();
    const conflictos = await citasEnConflicto(perfil.id, inicio);
    if (conflictos.length > 0 && req.body?.rescheduleConflicts !== true) {
      return res.status(409).json({
        message:
          "Tienes citas en ese horario. Si aceptas, se cancelan y se pide a esos clientes que reagenden, " +
          "porque la urgencia tiene prioridad.",
        code: "APPOINTMENT_CONFLICT",
        conflicts: conflictos.map((c) => ({
          id: c.id,
          client: c.client.name,
          scheduledAt: c.scheduledAt,
          durationMinutes: c.durationMinutes,
        })),
      });
    }

    const toma = await prisma.emergencyRequest.updateMany({
      where: { id, status: "OPEN", createdAt: { gte: new Date(Date.now() - TTL_MS) } },
      data: { status: "ACCEPTED", vetProfileId: perfil.id, acceptedAt: new Date() },
    });
    if (toma.count === 0) {
      return res.status(409).json({ message: "Otro veterinario ya tomó esta urgencia, o venció." });
    }

    // Las citas desplazadas se cancelan y se avisa a cada cliente para que reagende.
    if (conflictos.length > 0) {
      await prisma.appointment.updateMany({
        where: { id: { in: conflictos.map((c) => c.id) }, status: { in: ["PENDING", "CONFIRMED"] } },
        data: { status: "CANCELLED" },
      });
      for (const c of conflictos) {
        await notificationService.notify(
          c.clientId,
          `${req.user.name} tuvo que cancelar tu cita del ${describeDateTime(c.scheduledAt)} porque atiende una ` +
            "urgencia, que tiene prioridad. Te pedimos que reagendes: tu horario quedó libre en su agenda."
        );
      }
    }

    // La urgencia ocupa la agenda del veterinario como una cita confirmada.
    const cita = await prisma.appointment.create({
      data: {
        mode: urgencia.mode,
        scheduledAt: inicio,
        durationMinutes: URGENCY_MINUTES,
        address: urgencia.mode === "HOME" ? urgencia.address : null,
        notes: `URGENCIA: ${urgencia.symptoms}`,
        status: "CONFIRMED",
        clientId: urgencia.clientId,
        vetProfileId: perfil.id,
        petId: urgencia.petId,
        reminderSentAt: inicio, // no hace falta recordarla: es para ahora
      },
    });
    await prisma.emergencyRequest.update({ where: { id }, data: { appointmentId: cita.id } });

    const aceptada = await prisma.emergencyRequest.findUnique({ where: { id }, include: INCLUDE });
    await notificationService.notify(
      aceptada.clientId,
      `${req.user.name} aceptó tu urgencia. ` +
        (perfil.phone ? `Llámalo al ${perfil.phone}. ` : "") +
        (aceptada.mode === "CLINIC" ? `Te espera en ${perfil.address || "su veterinaria"}.` : "Va en camino a la dirección que indicaste.")
    );
    return res.status(200).json({
      message:
        `Urgencia aceptada. Quedó en tu agenda por ${URGENCY_MINUTES} minutos.` +
        (conflictos.length > 0 ? ` Se pidió reagendar a ${conflictos.length} cliente(s).` : "") +
        " Contacta al dueño.",
      emergency: toVetView(aceptada),
    });
  } catch (error) {
    return serverError(res, "acceptEmergency", error);
  }
}

async function disponibleAhora(perfil) {
  const lista = await vetsDisponibles(null);
  return lista.some((p) => p.id === perfil.id);
}

// La cita de una urgencia sigue el estado de la urgencia.
async function cerrarCita(appointmentId, status) {
  if (!appointmentId) return;
  await prisma.appointment.updateMany({
    where: { id: appointmentId, status: { in: ["PENDING", "CONFIRMED"] } },
    data: { status },
  });
}

// Carga una urgencia aceptada por este veterinario.
async function cargarPropiaAceptada(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ message: "El identificador de la urgencia no es valido." });
    return null;
  }
  await expireOld();
  const urgencia = await prisma.emergencyRequest.findFirst({
    where: { id, vetProfileId: req.user.vetProfile.id },
    include: INCLUDE,
  });
  if (!urgencia) {
    res.status(404).json({ message: "La urgencia no existe." });
    return null;
  }
  if (urgencia.status !== "ACCEPTED") {
    res.status(409).json({ message: "La urgencia ya no está en curso." });
    return null;
  }
  return urgencia;
}

// PATCH /api/emergencies/:id/complete
async function completeEmergency(req, res) {
  try {
    const urgencia = await cargarPropiaAceptada(req, res);
    if (!urgencia) return undefined;

    const r = await prisma.emergencyRequest.updateMany({
      where: { id: urgencia.id, vetProfileId: req.user.vetProfile.id, status: "ACCEPTED" },
      data: { status: "COMPLETED", closedAt: new Date() },
    });
    if (r.count === 0) return res.status(409).json({ message: "La urgencia cambió de estado. Actualiza la página." });

    await cerrarCita(urgencia.appointmentId, "COMPLETED");
    await notificationService.notify(
      urgencia.clientId,
      `${req.user.name} marcó tu urgencia como atendida. Si necesitas seguimiento, agenda una cita.`
    );
    return res.status(200).json({ message: "Urgencia marcada como atendida." });
  } catch (error) {
    return serverError(res, "completeEmergency", error);
  }
}

// PATCH /api/emergencies/:id/release
// El veterinario no puede atenderla: vuelve a abrirse para los demas.
async function releaseEmergency(req, res) {
  try {
    const urgencia = await cargarPropiaAceptada(req, res);
    if (!urgencia) return undefined;

    const r = await prisma.emergencyRequest.updateMany({
      where: { id: urgencia.id, vetProfileId: req.user.vetProfile.id, status: "ACCEPTED" },
      data: { status: "OPEN", vetProfileId: null, acceptedAt: null, appointmentId: null },
    });
    if (r.count === 0) return res.status(409).json({ message: "La urgencia cambió de estado. Actualiza la página." });

    await cerrarCita(urgencia.appointmentId, "CANCELLED"); // la agenda queda libre

    await notificationService.notify(
      urgencia.clientId,
      `${req.user.name} no puede atender tu urgencia. La abrimos de nuevo para los demás veterinarios de turno.`
    );
    const otros = await vetsDisponibles(urgencia.mode, { excluir: req.user.vetProfile.id });
    await notificationService.notifyMany(
      otros.map((v) => v.userId),
      `URGENCIA ${urgencia.mode === "HOME" ? "a domicilio" : "en la veterinaria"} de nuevo disponible: ${resumen(urgencia.symptoms)}.`
    );
    return res.status(200).json({ message: "Urgencia liberada. Otro veterinario podrá tomarla." });
  } catch (error) {
    return serverError(res, "releaseEmergency", error);
  }
}

module.exports = {
  availability,
  createEmergency,
  cancelEmergency,
  listOpen,
  listMine,
  acceptEmergency,
  completeEmergency,
  releaseEmergency,
  TTL_MIN,
  URGENCY_MINUTES,
};
