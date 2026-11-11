// Urgencias (lo que AN-23 llamaba "emergencias").
//
// Flujo:
//   1. El veterinario se pone "de turno" por 4, 8 o 12 horas.
//   2. El dueño describe la urgencia (sintomas, mascota, telefono y si es en la
//      veterinaria o a domicilio).
//   3. Se avisa a los veterinarios de turno compatibles con la modalidad. El
//      primero que la acepta se queda con ella (la toma es atomica).
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

const TTL_MIN = Number(process.env.EMERGENCY_TTL_MIN) || 30;
const TTL_MS = TTL_MIN * 60 * 1000;
const DUTY_HOURS = [4, 8, 12];
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

// Veterinarios activos y de turno ahora, compatibles con la modalidad.
function onDutyWhere(mode) {
  const where = { emergencyUntil: { gt: new Date() }, user: { status: "ACTIVE" } };
  if (mode === "HOME") where.homeService = true;
  if (mode === "CLINIC") where.clinicService = true;
  return where;
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
// Cuantos veterinarios estan de turno ahora, para avisar antes de pedir.
async function availability(req, res) {
  try {
    const [total, home, clinic] = await Promise.all([
      prisma.vetProfile.count({ where: onDutyWhere() }),
      prisma.vetProfile.count({ where: onDutyWhere("HOME") }),
      prisma.vetProfile.count({ where: onDutyWhere("CLINIC") }),
    ]);
    return res.status(200).json({ onDuty: total, home, clinic, ttlMinutes: TTL_MIN });
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

    const veterinarios = await prisma.vetProfile.findMany({
      where: onDutyWhere(modo),
      select: { userId: true },
    });
    if (veterinarios.length === 0) {
      return res.status(409).json({
        message:
          "No hay veterinarios de turno en este momento para esa modalidad. " +
          "Si tu mascota está grave, acude de inmediato a la clínica veterinaria más cercana.",
        code: "NO_VETS_ON_DUTY",
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
      message: `Avisamos a ${veterinarios.length} veterinario(s) de turno. Te mostraremos aquí quién la acepta.`,
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

// GET /api/emergencies/duty
async function getDuty(req, res) {
  try {
    const perfil = await prisma.vetProfile.findUnique({ where: { id: req.user.vetProfile.id } });
    const activo = Boolean(perfil.emergencyUntil && perfil.emergencyUntil > new Date());
    return res.status(200).json({
      active: activo,
      until: activo ? perfil.emergencyUntil : null,
      hoursOptions: DUTY_HOURS,
      canGoOnDuty: req.user.status === "ACTIVE",
    });
  } catch (error) {
    return serverError(res, "getDuty", error);
  }
}

// PUT /api/emergencies/duty  { hours: 0 | 4 | 8 | 12 }   (0 = salir de turno)
async function setDuty(req, res) {
  try {
    const horas = Number(req.body?.hours);
    if (!Number.isInteger(horas) || (horas !== 0 && !DUTY_HOURS.includes(horas))) {
      return badRequest(res, [`Elige un turno de ${DUTY_HOURS.join(", ")} horas, o 0 para salir de turno.`]);
    }
    if (horas > 0 && req.user.status !== "ACTIVE") {
      return res.status(409).json({ message: "Tu cuenta debe estar aprobada para atender urgencias." });
    }
    const hasta = horas === 0 ? null : new Date(Date.now() + horas * 60 * 60 * 1000);
    await prisma.vetProfile.update({ where: { id: req.user.vetProfile.id }, data: { emergencyUntil: hasta } });
    return res.status(200).json({
      message: horas === 0 ? "Saliste de turno. Ya no recibirás urgencias." : `Estás de turno por ${horas} horas.`,
      active: horas > 0,
      until: hasta,
    });
  } catch (error) {
    return serverError(res, "setDuty", error);
  }
}

// El veterinario debe estar de turno para ver y aceptar urgencias.
async function perfilDeTurno(req) {
  const perfil = await prisma.vetProfile.findUnique({ where: { id: req.user.vetProfile.id } });
  const deTurno = Boolean(perfil.emergencyUntil && perfil.emergencyUntil > new Date());
  return { perfil, deTurno };
}

// GET /api/emergencies/open
async function listOpen(req, res) {
  try {
    await expireOld();
    const { perfil, deTurno } = await perfilDeTurno(req);
    if (!deTurno) return res.status(200).json({ onDuty: false, requests: [] });

    const modos = [];
    if (perfil.clinicService) modos.push("CLINIC");
    if (perfil.homeService) modos.push("HOME");
    const abiertas = await prisma.emergencyRequest.findMany({
      where: { status: "OPEN", mode: { in: modos } },
      include: INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return res.status(200).json({ onDuty: true, requests: abiertas.map(toVetView) });
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

    const { perfil, deTurno } = await perfilDeTurno(req);
    if (!deTurno) {
      return res.status(409).json({ message: "Debes estar de turno para aceptar urgencias." });
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

    const toma = await prisma.emergencyRequest.updateMany({
      where: { id, status: "OPEN", createdAt: { gte: new Date(Date.now() - TTL_MS) } },
      data: { status: "ACCEPTED", vetProfileId: perfil.id, acceptedAt: new Date() },
    });
    if (toma.count === 0) {
      return res.status(409).json({ message: "Otro veterinario ya tomó esta urgencia, o venció." });
    }

    const aceptada = await prisma.emergencyRequest.findUnique({ where: { id }, include: INCLUDE });
    await notificationService.notify(
      aceptada.clientId,
      `${req.user.name} aceptó tu urgencia. ` +
        (perfil.phone ? `Llámalo al ${perfil.phone}. ` : "") +
        (aceptada.mode === "CLINIC" ? `Te espera en ${perfil.address || "su veterinaria"}.` : "Va en camino a la dirección que indicaste.")
    );
    return res.status(200).json({ message: "Urgencia aceptada. Contacta al dueño.", emergency: toVetView(aceptada) });
  } catch (error) {
    return serverError(res, "acceptEmergency", error);
  }
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
      data: { status: "OPEN", vetProfileId: null, acceptedAt: null },
    });
    if (r.count === 0) return res.status(409).json({ message: "La urgencia cambió de estado. Actualiza la página." });

    await notificationService.notify(
      urgencia.clientId,
      `${req.user.name} no puede atender tu urgencia. La abrimos de nuevo para los demás veterinarios de turno.`
    );
    const otros = await prisma.vetProfile.findMany({
      where: { ...onDutyWhere(urgencia.mode), id: { not: req.user.vetProfile.id } },
      select: { userId: true },
    });
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
  getDuty,
  setDuty,
  listOpen,
  listMine,
  acceptEmergency,
  completeEmergency,
  releaseEmergency,
  TTL_MIN,
};
