// Historias clinicas (epica AN-3).
//
// AN-18 el veterinario crea una entrada en la historia de una mascota
// AN-19 el veterinario elimina (anula) una entrada suya, con motivo
// AN-20 el veterinario modifica una entrada suya
// AN-21 el dueño consulta la historia de su mascota
//
// Reglas de acceso:
// - El dueño ve las entradas vigentes de sus propias mascotas.
// - Un veterinario ve y crea entradas solo de mascotas que tienen (o tuvieron)
//   una cita con el, no cancelada. Ve la historia completa, incluidas las
//   entradas de otros veterinarios, para dar continuidad a la atencion.
// - Solo el veterinario que escribio una entrada puede modificarla o anularla.
const prisma = require("../prisma");
const notificationService = require("../services/notification.service");
const { parseId } = require("../utils/params");
const { parseDate, toDateString, describeDateTime, startOfDay } = require("../utils/schedule");

const MAX_REASON = 200;
const MAX_TEXT = 2000;
const MAX_ANNUL_REASON = 200;

function serverError(res, where, error) {
  console.error(`Error en ${where}:`, error);
  return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
}

function badRequest(res, errors) {
  return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
}

const RECORD_INCLUDE = {
  vetProfile: { include: { user: { select: { name: true } } } },
};

function toPublicRecord(record, { paraVeterinario, vetProfileId }) {
  const publico = {
    id: record.id,
    visitDate: toDateString(record.visitDate),
    reason: record.reason,
    diagnosis: record.diagnosis,
    treatment: record.treatment,
    weight: record.weight === null ? null : Number(record.weight),
    temperature: record.temperature === null ? null : Number(record.temperature),
    vaccines: record.vaccines,
    observations: record.observations,
    appointmentId: record.appointmentId,
    vet: { id: record.vetProfileId, name: record.vetProfile.user.name, specialty: record.vetProfile.specialty },
    createdAt: record.createdAt,
    // Se marca como editada si se cambio despues de crearla (mas de un minuto).
    edited: record.updatedAt.getTime() - record.createdAt.getTime() > 60 * 1000,
  };
  if (paraVeterinario) {
    publico.status = record.status;
    publico.annulReason = record.annulReason;
    publico.annulledAt = record.annulledAt;
    publico.canEdit = record.vetProfileId === vetProfileId && record.status === "ACTIVE";
  }
  return publico;
}

function toPetSummary(pet) {
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    sex: pet.sex,
    birthDate: toDateString(pet.birthDate),
    weight: pet.weight === null ? null : Number(pet.weight),
    owner: pet.user ? { name: pet.user.name } : undefined,
  };
}

// ¿El veterinario atiende (o atendio) a esta mascota?
async function vetTieneRelacion(vetProfileId, petId) {
  const cita = await prisma.appointment.findFirst({
    where: { vetProfileId, petId, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  return Boolean(cita);
}

// Carga la mascota si quien pide tiene acceso a su historia. Si no, responde
// 404 (no se revela que la mascota existe) y devuelve null.
async function cargarMascotaConAcceso(req, res, petId) {
  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    include: { user: { select: { id: true, name: true } } },
  });
  let permitido = false;
  if (pet && req.user.role === "CLIENT") {
    permitido = pet.userId === req.user.id;
  } else if (pet && req.user.role === "VETERINARIAN" && req.user.vetProfile) {
    permitido = await vetTieneRelacion(req.user.vetProfile.id, pet.id);
  }
  if (!permitido) {
    res.status(404).json({ message: "La mascota no existe o no tienes acceso a su historia clínica." });
    return null;
  }
  return pet;
}

function textoOpcional(valor) {
  const texto = valor === undefined || valor === null ? "" : String(valor).trim();
  return texto === "" ? null : texto;
}

// Valida los campos clinicos. Devuelve { errors, value }.
function validateRecord(body = {}) {
  const errors = [];
  const reason = String(body.reason ?? "").trim();
  const diagnosis = String(body.diagnosis ?? "").trim();
  const treatment = textoOpcional(body.treatment);
  const vaccines = textoOpcional(body.vaccines);
  const observations = textoOpcional(body.observations);

  if (reason === "") errors.push("El motivo de consulta es obligatorio.");
  else if (reason.length > MAX_REASON) errors.push(`El motivo no puede superar los ${MAX_REASON} caracteres.`);
  if (diagnosis === "") errors.push("El diagnóstico es obligatorio.");
  else if (diagnosis.length > MAX_TEXT) errors.push(`El diagnóstico no puede superar los ${MAX_TEXT} caracteres.`);
  for (const [valor, nombre] of [
    [treatment, "El tratamiento"],
    [vaccines, "El campo de vacunas"],
    [observations, "El campo de observaciones"],
  ]) {
    if (valor && valor.length > MAX_TEXT) errors.push(`${nombre} no puede superar los ${MAX_TEXT} caracteres.`);
  }

  let weight = null;
  const pesoTexto = textoOpcional(body.weight);
  if (pesoTexto !== null) {
    if (!/^\d+(\.\d{1,2})?$/.test(pesoTexto) || Number(pesoTexto) <= 0 || Number(pesoTexto) > 200) {
      errors.push("El peso debe ser un número mayor a 0 y hasta 200 kg.");
    } else {
      weight = Number(pesoTexto);
    }
  }

  let temperature = null;
  const tempTexto = textoOpcional(body.temperature);
  if (tempTexto !== null) {
    if (!/^\d+(\.\d)?$/.test(tempTexto) || Number(tempTexto) < 30 || Number(tempTexto) > 45) {
      errors.push("La temperatura debe estar entre 30 y 45 °C.");
    } else {
      temperature = Number(tempTexto);
    }
  }

  let visitDate = null;
  if (body.visitDate !== undefined && body.visitDate !== null && String(body.visitDate).trim() !== "") {
    visitDate = parseDate(body.visitDate);
    if (!visitDate) errors.push("La fecha de la consulta no es válida (formato AAAA-MM-DD).");
    else if (visitDate.getTime() > Date.now()) errors.push("La fecha de la consulta no puede estar en el futuro.");
  }

  return { errors, value: { reason, diagnosis, treatment, vaccines, observations, weight, temperature, visitDate } };
}

// GET /api/medical-records/pets/:petId
// AN-21 (dueño) y consulta del veterinario. El dueño solo ve entradas vigentes.
async function getPetHistory(req, res) {
  try {
    const petId = parseId(req.params.petId);
    if (!petId) return res.status(400).json({ message: "El identificador de la mascota no es valido." });

    const pet = await cargarMascotaConAcceso(req, res, petId);
    if (!pet) return undefined;

    const paraVeterinario = req.user.role === "VETERINARIAN";
    const records = await prisma.medicalRecord.findMany({
      where: { petId, ...(paraVeterinario ? {} : { status: "ACTIVE" }) },
      include: RECORD_INCLUDE,
      orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
    });

    // Para el veterinario: citas suyas con esta mascota que ya pasaron y aun
    // no tienen entrada, para registrarlas con un clic.
    let pendingAppointments;
    if (paraVeterinario) {
      const citas = await prisma.appointment.findMany({
        where: {
          vetProfileId: req.user.vetProfile.id,
          petId,
          status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
          scheduledAt: { lte: new Date() },
          medicalRecord: null,
        },
        include: { service: { select: { name: true } } },
        orderBy: { scheduledAt: "desc" },
      });
      pendingAppointments = citas.map((c) => ({
        id: c.id,
        date: toDateString(c.scheduledAt),
        when: describeDateTime(c.scheduledAt),
        service: c.service ? c.service.name : "Consulta general",
        notes: c.notes,
      }));
    }

    const opciones = { paraVeterinario, vetProfileId: req.user.vetProfile?.id };
    return res.status(200).json({
      pet: toPetSummary(paraVeterinario ? pet : { ...pet, user: undefined }),
      records: records.map((r) => toPublicRecord(r, opciones)),
      ...(paraVeterinario ? { pendingAppointments } : {}),
    });
  } catch (error) {
    return serverError(res, "getPetHistory", error);
  }
}

// POST /api/medical-records   (AN-18)
// body: { petId, appointmentId?, visitDate?, reason, diagnosis, treatment?, weight?, temperature?, vaccines?, observations? }
async function createRecord(req, res) {
  try {
    const body = req.body || {};
    const petId = parseId(body.petId);
    if (!petId) return badRequest(res, ["Debes indicar la mascota."]);

    const { errors, value } = validateRecord(body);

    let appointment = null;
    if (body.appointmentId !== undefined && body.appointmentId !== null && String(body.appointmentId) !== "") {
      const appointmentId = parseId(body.appointmentId);
      if (!appointmentId) errors.push("El identificador de la cita no es valido.");
      else {
        appointment = await prisma.appointment.findUnique({
          where: { id: appointmentId },
          include: { medicalRecord: { select: { id: true } } },
        });
      }
    }
    if (errors.length > 0) return badRequest(res, errors);

    const vetProfileId = req.user.vetProfile.id;
    const pet = await cargarMascotaConAcceso(req, res, petId);
    if (!pet) return undefined;
    if (pet.status !== "ACTIVE") {
      return res.status(409).json({ message: "La mascota fue retirada por su dueño; no se pueden agregar entradas." });
    }

    if (body.appointmentId !== undefined && body.appointmentId !== null && String(body.appointmentId) !== "") {
      if (!appointment || appointment.vetProfileId !== vetProfileId || appointment.petId !== petId) {
        return res.status(404).json({ message: "La cita no existe o no corresponde a esta mascota." });
      }
      if (appointment.status === "CANCELLED") {
        return res.status(409).json({ message: "No se puede registrar una cita cancelada." });
      }
      if (appointment.scheduledAt.getTime() > Date.now()) {
        return res.status(409).json({ message: "La cita aún no ha ocurrido." });
      }
      if (appointment.medicalRecord) {
        return res.status(409).json({ message: "Esta cita ya tiene una entrada en la historia clínica." });
      }
    }

    // Fecha: la indicada, la de la cita o hoy.
    const visitDate =
      value.visitDate || (appointment ? startOfDay(appointment.scheduledAt) : startOfDay());

    const campos = { ...value };
    delete campos.visitDate;
    let record;
    try {
      record = await prisma.$transaction(async (tx) => {
        const creado = await tx.medicalRecord.create({
          data: { ...campos, visitDate, petId, vetProfileId, appointmentId: appointment ? appointment.id : null },
          include: RECORD_INCLUDE,
        });
        // El peso medido en consulta pasa a ser el peso actual de la mascota.
        if (campos.weight !== null) {
          await tx.pet.update({ where: { id: petId }, data: { weight: campos.weight } });
        }
        return creado;
      });
    } catch (error) {
      if (error && error.code === "P2002") {
        return res.status(409).json({ message: "Esta cita ya tiene una entrada en la historia clínica." });
      }
      throw error;
    }

    try {
      await notificationService.notify(
        pet.userId,
        `${req.user.name} agregó una entrada a la historia clínica de ${pet.name}: ${campos.reason}.`
      );
    } catch (error) {
      console.error("No se pudo notificar la nueva entrada:", error);
    }

    return res.status(201).json({
      message: "Entrada agregada a la historia clínica.",
      record: toPublicRecord(record, { paraVeterinario: true, vetProfileId }),
    });
  } catch (error) {
    return serverError(res, "createRecord", error);
  }
}

// Carga una entrada que el veterinario puede cambiar (suya y vigente).
async function cargarEntradaPropia(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ message: "El identificador de la entrada no es valido." });
    return null;
  }
  const record = await prisma.medicalRecord.findUnique({ where: { id } });
  if (!record || !(await vetTieneRelacion(req.user.vetProfile.id, record.petId))) {
    res.status(404).json({ message: "La entrada no existe." });
    return null;
  }
  if (record.vetProfileId !== req.user.vetProfile.id) {
    res.status(403).json({ message: "Solo el veterinario que escribió la entrada puede cambiarla." });
    return null;
  }
  if (record.status !== "ACTIVE") {
    res.status(409).json({ message: "La entrada está anulada y no se puede cambiar." });
    return null;
  }
  return record;
}

// PUT /api/medical-records/:id   (AN-20)
async function updateRecord(req, res) {
  try {
    const actual = await cargarEntradaPropia(req, res);
    if (!actual) return undefined;

    const { errors, value } = validateRecord(req.body);
    if (errors.length > 0) return badRequest(res, errors);

    const { visitDate, ...campos } = value;
    const record = await prisma.medicalRecord.update({
      where: { id: actual.id },
      data: { ...campos, ...(visitDate ? { visitDate } : {}) },
      include: RECORD_INCLUDE,
    });
    if (campos.weight !== null) {
      await prisma.pet.update({ where: { id: actual.petId }, data: { weight: campos.weight } });
    }

    return res.status(200).json({
      message: "Entrada actualizada.",
      record: toPublicRecord(record, { paraVeterinario: true, vetProfileId: req.user.vetProfile.id }),
    });
  } catch (error) {
    return serverError(res, "updateRecord", error);
  }
}

// PATCH /api/medical-records/:id/annul   body: { reason }   (AN-19)
// "Eliminar" anula la entrada: el dueño deja de verla y se conserva para auditoria.
async function annulRecord(req, res) {
  try {
    const actual = await cargarEntradaPropia(req, res);
    if (!actual) return undefined;

    const motivo = String(req.body?.reason ?? "").trim();
    if (motivo === "") return badRequest(res, ["Indica el motivo para eliminar la entrada."]);
    if (motivo.length > MAX_ANNUL_REASON) {
      return badRequest(res, [`El motivo no puede superar los ${MAX_ANNUL_REASON} caracteres.`]);
    }

    const record = await prisma.medicalRecord.update({
      where: { id: actual.id },
      data: { status: "ANNULLED", annulReason: motivo, annulledAt: new Date() },
      include: RECORD_INCLUDE,
    });
    return res.status(200).json({
      message: "Entrada eliminada de la historia clínica.",
      record: toPublicRecord(record, { paraVeterinario: true, vetProfileId: req.user.vetProfile.id }),
    });
  } catch (error) {
    return serverError(res, "annulRecord", error);
  }
}

module.exports = { getPetHistory, createRecord, updateRecord, annulRecord };
