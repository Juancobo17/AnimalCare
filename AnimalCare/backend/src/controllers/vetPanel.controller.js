// Panel del veterinario: lo que el profesional gestiona de su propio perfil.
//
// AN-28 agregar servicios, AN-29 eliminar servicios, AN-30 asignar y modificar
// precios, AN-31 horario base y bloqueos excepcionales.
//
// El perfil se toma SIEMPRE de req.user.vetProfile (del token): un veterinario
// no puede tocar los servicios ni la agenda de otro.
const panelService = require("../services/vetPanel.service");
const { toPublicService } = require("../services/vet.service");
const { toPublicAppointment } = require("../services/appointment.service");
const { validateServiceInput } = require("../utils/serviceValidation");
const { parseId } = require("../utils/params");
const { parseDate, parseTime, toTimeString } = require("../utils/schedule");
const uploads = require("../utils/uploads");
const prisma = require("../prisma");

const MAX_FRANJAS = 21;
const MAX_BLOCK_DAYS = 365;
const MAX_REASON_LENGTH = 150;
const DIA_MS = 24 * 60 * 60 * 1000;

function badRequest(res, errors) {
  return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
}

function serverError(res, where, error) {
  console.error(`Error en ${where}:`, error);
  return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
}

// Un usuario VETERINARIAN siempre tiene perfil; si faltara, no hay nada que gestionar.
function vetProfileId(req) {
  return req.user.vetProfile ? req.user.vetProfile.id : null;
}

// ==================== Servicios ====================

// GET /api/vets/me/services
async function listMyServices(req, res) {
  try {
    const servicios = await panelService.findActiveServices(vetProfileId(req));
    return res.status(200).json({
      // AN-28 criterio 2: con la cuenta pendiente se guardan pero no son publicos.
      visible: req.user.status === "ACTIVE",
      services: servicios.map(toPublicService),
    });
  } catch (error) {
    return serverError(res, "listMyServices", error);
  }
}

// POST /api/vets/me/services  (AN-28, AN-30 criterio 1)
async function addService(req, res) {
  try {
    const { errors, value } = validateServiceInput(req.body || {});
    if (errors.length > 0) {
      return badRequest(res, errors);
    }

    const servicio = await panelService.createService(vetProfileId(req), value);
    const message = req.user.status === "ACTIVE"
      ? "Servicio agregado. Ya es visible en tu perfil público."
      : "Servicio guardado. Será visible en tu perfil cuando tu cuenta sea aprobada.";

    return res.status(201).json({ message, service: toPublicService(servicio) });
  } catch (error) {
    return serverError(res, "addService", error);
  }
}

// PUT /api/vets/me/services/:serviceId  (AN-30 criterios 2 y 4)
async function updateService(req, res) {
  try {
    const serviceId = parseId(req.params.serviceId);
    if (!serviceId) {
      return res.status(400).json({ message: "El identificador del servicio no es valido." });
    }

    const actual = await panelService.findOwnService(vetProfileId(req), serviceId);
    if (!actual) {
      return res.status(404).json({ message: "El servicio no existe." });
    }

    const { errors, value } = validateServiceInput(req.body || {});
    if (errors.length > 0) {
      return badRequest(res, errors);
    }

    const cambioPrecio = Number(actual.price) !== value.price;
    const servicio = await panelService.updateService(actual, value);

    return res.status(200).json({
      message: cambioPrecio ? "Precio actualizado correctamente" : "Servicio actualizado correctamente",
      service: toPublicService(servicio),
    });
  } catch (error) {
    return serverError(res, "updateService", error);
  }
}

// DELETE /api/vets/me/services/:serviceId  (AN-29)
async function removeService(req, res) {
  try {
    const serviceId = parseId(req.params.serviceId);
    if (!serviceId) {
      return res.status(400).json({ message: "El identificador del servicio no es valido." });
    }

    const actual = await panelService.findOwnService(vetProfileId(req), serviceId);
    if (!actual) {
      return res.status(404).json({ message: "El servicio no existe." });
    }

    await panelService.deactivateService(serviceId);

    return res.status(200).json({
      message: "Servicio eliminado. Ya no se podrá seleccionar en nuevas citas.",
    });
  } catch (error) {
    return serverError(res, "removeService", error);
  }
}

// ==================== Horario base (AN-31 criterio 1) ====================

function toPublicAvailability(item) {
  return { weekday: item.weekday, startTime: item.startTime, endTime: item.endTime };
}

// GET /api/vets/me/availability
async function getMyAvailability(req, res) {
  try {
    const franjas = await panelService.findAvailabilities(vetProfileId(req));
    return res.status(200).json({ availabilities: franjas.map(toPublicAvailability) });
  } catch (error) {
    return serverError(res, "getMyAvailability", error);
  }
}

// Valida la lista de franjas semanales. Devuelve { errors, values }.
function validateAvailabilities(lista) {
  const errors = [];
  const values = [];

  if (!Array.isArray(lista) || lista.length === 0) {
    return { errors: ["Debes definir al menos una franja de atención."], values };
  }
  if (lista.length > MAX_FRANJAS) {
    return { errors: [`No puedes definir más de ${MAX_FRANJAS} franjas.`], values };
  }

  lista.forEach((item, index) => {
    const n = index + 1;
    const weekday = Number(item?.weekday);
    const inicio = parseTime(item?.startTime);
    const fin = parseTime(item?.endTime);

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      errors.push(`La franja ${n} tiene un día de la semana no válido.`);
      return;
    }
    if (inicio === null || fin === null) {
      errors.push(`La franja ${n} debe tener hora de inicio y de fin con formato HH:MM.`);
      return;
    }
    if (fin <= inicio) {
      errors.push(`En la franja ${n} la hora de fin debe ser posterior a la de inicio.`);
      return;
    }
    values.push({ weekday, startTime: toTimeString(inicio), endTime: toTimeString(fin), inicio, fin });
  });

  // Dos franjas del mismo dia no pueden cruzarse.
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      const a = values[i];
      const b = values[j];
      if (a.weekday === b.weekday && a.inicio < b.fin && b.inicio < a.fin) {
        errors.push(`Las franjas ${a.startTime}-${a.endTime} y ${b.startTime}-${b.endTime} del mismo día se cruzan.`);
      }
    }
  }

  return {
    errors,
    values: values.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })),
  };
}

// PUT /api/vets/me/availability
// Las citas ya agendadas no se tocan: el horario nuevo rige para lo que se agende despues.
async function updateMyAvailability(req, res) {
  try {
    const { errors, values } = validateAvailabilities(req.body?.availabilities);
    if (errors.length > 0) {
      return badRequest(res, errors);
    }

    const franjas = await panelService.replaceAvailabilities(vetProfileId(req), values);

    return res.status(200).json({
      message: "Horario actualizado correctamente.",
      availabilities: franjas.map(toPublicAvailability),
    });
  } catch (error) {
    return serverError(res, "updateMyAvailability", error);
  }
}

// ==================== Bloqueos (AN-31 criterios 2, 3 y 4) ====================

// GET /api/vets/me/blocks
async function listMyBlocks(req, res) {
  try {
    const bloqueos = await panelService.findUpcomingBlocks(vetProfileId(req));
    return res.status(200).json({ blocks: bloqueos.map(panelService.toPublicBlock) });
  } catch (error) {
    return serverError(res, "listMyBlocks", error);
  }
}

// POST /api/vets/me/blocks
// body: { date, allDay, startTime, endTime, reason, confirm }
// Si hay citas en el rango y confirm no es true, responde 409 con la lista
// para que el veterinario decida si continua (cancelandolas) o aborta.
async function addBlock(req, res) {
  try {
    const body = req.body || {};
    const errors = [];

    const fecha = parseDate(body.date);
    const diaCompleto = body.allDay === true || body.allDay === "true";
    const motivoTexto = body.reason === undefined || body.reason === null ? "" : String(body.reason).trim();

    if (!body.date || String(body.date).trim() === "") {
      errors.push("Debes indicar la fecha que quieres bloquear.");
    } else if (!fecha) {
      errors.push("La fecha no es válida (formato AAAA-MM-DD).");
    }

    let inicio = 0;
    let fin = 24 * 60;
    if (!diaCompleto) {
      inicio = parseTime(body.startTime);
      fin = parseTime(body.endTime);
      if (inicio === null || fin === null) {
        errors.push("Indica la hora de inicio y de fin del bloqueo (HH:MM), o marca el día completo.");
      } else if (fin <= inicio) {
        errors.push("La hora de fin del bloqueo debe ser posterior a la de inicio.");
      }
    }

    if (motivoTexto.length > MAX_REASON_LENGTH) {
      errors.push(`El motivo no puede superar los ${MAX_REASON_LENGTH} caracteres.`);
    }

    if (errors.length > 0) {
      return badRequest(res, errors);
    }

    const startsAt = new Date(fecha.getTime() + inicio * 60 * 1000);
    const endsAt = new Date(fecha.getTime() + fin * 60 * 1000);

    if (endsAt.getTime() <= Date.now()) {
      return badRequest(res, ["No puedes bloquear un horario que ya pasó."]);
    }
    if (startsAt.getTime() > Date.now() + MAX_BLOCK_DAYS * DIA_MS) {
      return badRequest(res, [`Solo puedes bloquear fechas dentro del próximo año.`]);
    }

    const id = vetProfileId(req);
    const conflictos = await panelService.findConflictingAppointments(id, startsAt, endsAt);
    const confirmado = body.confirm === true || body.confirm === "true";

    if (conflictos.length > 0 && !confirmado) {
      return res.status(409).json({
        code: "BLOCK_CONFLICT",
        message:
          `Tienes ${conflictos.length} cita(s) agendada(s) en ese periodo. ` +
          "Si continúas con el bloqueo, se cancelarán y se avisará a cada cliente.",
        conflicts: conflictos.map(toPublicAppointment),
      });
    }

    const bloqueo = await panelService.createBlockCancelling(
      id,
      { startsAt, endsAt, reason: motivoTexto === "" ? null : motivoTexto },
      conflictos,
      req.user.name
    );

    return res.status(201).json({
      message: conflictos.length > 0
        ? `Horario bloqueado. Se cancelaron ${conflictos.length} cita(s) y se avisó a los clientes.`
        : "Horario bloqueado correctamente.",
      cancelledAppointments: conflictos.length,
      block: panelService.toPublicBlock(bloqueo),
    });
  } catch (error) {
    return serverError(res, "addBlock", error);
  }
}

// DELETE /api/vets/me/blocks/:blockId
// Quitar un bloqueo vuelve a ofrecer esos horarios. Las citas que se
// cancelaron al crearlo siguen canceladas.
async function removeBlock(req, res) {
  try {
    const blockId = parseId(req.params.blockId);
    if (!blockId) {
      return res.status(400).json({ message: "El identificador del bloqueo no es valido." });
    }

    const bloqueo = await panelService.findOwnBlock(vetProfileId(req), blockId);
    if (!bloqueo) {
      return res.status(404).json({ message: "El bloqueo no existe." });
    }

    await panelService.deleteBlock(blockId);
    return res.status(200).json({ message: "Bloqueo eliminado. Esos horarios vuelven a estar disponibles." });
  } catch (error) {
    return serverError(res, "removeBlock", error);
  }
}

// ==================== Perfil, foto y tarjeta profesional ====================

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_DOC_BYTES = 5 * 1024 * 1024;

async function cargarPerfil(req) {
  return prisma.vetProfile.findUnique({
    where: { id: vetProfileId(req) },
    include: { user: { select: { name: true, email: true, status: true } } },
  });
}

function toOwnProfile(perfil) {
  return {
    name: perfil.user.name,
    email: perfil.user.email,
    status: perfil.user.status,
    license: perfil.license,
    specialty: perfil.specialty,
    bio: perfil.bio,
    phone: perfil.phone,
    address: perfil.address,
    homeService: perfil.homeService,
    clinicService: perfil.clinicService,
    photoUrl: perfil.photoUrl,
    hasLicenseDoc: Boolean(perfil.licenseDocPath),
  };
}

// GET /api/vets/me/profile
async function getMyProfile(req, res) {
  try {
    return res.status(200).json({ profile: toOwnProfile(await cargarPerfil(req)) });
  } catch (error) {
    return serverError(res, "getMyProfile", error);
  }
}

function textoOpcional(valor) {
  const texto = valor === undefined || valor === null ? "" : String(valor).trim();
  return texto === "" ? null : texto;
}

// PUT /api/vets/me/profile   La matricula y el correo no se cambian desde aqui.
async function updateMyProfile(req, res) {
  try {
    const body = req.body || {};
    const errors = [];

    const specialty = String(body.specialty ?? "").trim();
    if (specialty.length < 3 || specialty.length > 60) {
      errors.push("La especialidad debe tener entre 3 y 60 caracteres.");
    }
    const bio = textoOpcional(body.bio);
    if (bio && bio.length > 500) errors.push("La presentación no puede superar los 500 caracteres.");
    const phone = textoOpcional(body.phone);
    if (phone && !/^[0-9+\s-]{7,15}$/.test(phone)) errors.push("El teléfono no tiene un formato válido.");

    const homeService = body.homeService === true;
    const clinicService = body.clinicService === true;
    if (!homeService && !clinicService) {
      errors.push("Debes ofrecer al menos una modalidad de atención: a domicilio o en veterinaria.");
    }
    const address = textoOpcional(body.address);
    if (clinicService && !address) {
      errors.push("La dirección del consultorio es obligatoria si atiendes en la veterinaria.");
    } else if (address && address.length > 150) {
      errors.push("La dirección no puede superar los 150 caracteres.");
    }
    if (errors.length > 0) return badRequest(res, errors);

    await prisma.vetProfile.update({
      where: { id: vetProfileId(req) },
      data: { specialty, bio, phone, address, homeService, clinicService },
    });
    return res.status(200).json({
      message: "Perfil actualizado correctamente.",
      profile: toOwnProfile(await cargarPerfil(req)),
    });
  } catch (error) {
    return serverError(res, "updateMyProfile", error);
  }
}

// PUT /api/vets/me/photo   body: { image: "data:image/jpeg;base64,..." }
async function uploadMyPhoto(req, res) {
  try {
    const archivo = uploads.parseDataUrl(req.body?.image, {
      tipos: ["image/jpeg", "image/png", "image/webp"],
      maxBytes: MAX_PHOTO_BYTES,
    });
    if (archivo.error) return badRequest(res, [archivo.error]);

    const perfil = await cargarPerfil(req);
    const photoUrl = await uploads.savePhoto(perfil.id, archivo);
    await prisma.vetProfile.update({ where: { id: perfil.id }, data: { photoUrl } });
    await uploads.deletePhoto(perfil.photoUrl);

    return res.status(200).json({ message: "Foto actualizada.", photoUrl });
  } catch (error) {
    return serverError(res, "uploadMyPhoto", error);
  }
}

// DELETE /api/vets/me/photo
async function deleteMyPhoto(req, res) {
  try {
    const perfil = await cargarPerfil(req);
    await prisma.vetProfile.update({ where: { id: perfil.id }, data: { photoUrl: null } });
    await uploads.deletePhoto(perfil.photoUrl);
    return res.status(200).json({ message: "Foto eliminada. Se mostrarán tus iniciales." });
  } catch (error) {
    return serverError(res, "deleteMyPhoto", error);
  }
}

// PUT /api/vets/me/license-doc   body: { file: "data:application/pdf;base64,..." }
// La tarjeta profesional solo la puede descargar el administrador (AN-35).
async function uploadMyLicenseDoc(req, res) {
  try {
    const archivo = uploads.parseDataUrl(req.body?.file, {
      tipos: ["application/pdf", "image/jpeg", "image/png"],
      maxBytes: MAX_DOC_BYTES,
    });
    if (archivo.error) return badRequest(res, [archivo.error]);

    const perfil = await cargarPerfil(req);
    const nombre = await uploads.saveDoc(perfil.id, archivo);
    await prisma.vetProfile.update({ where: { id: perfil.id }, data: { licenseDocPath: nombre } });
    await uploads.deleteDoc(perfil.licenseDocPath);

    return res.status(200).json({ message: "Tarjeta profesional cargada. El administrador la revisará." });
  } catch (error) {
    return serverError(res, "uploadMyLicenseDoc", error);
  }
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  uploadMyPhoto,
  deleteMyPhoto,
  uploadMyLicenseDoc,
  listMyServices,
  addService,
  updateService,
  removeService,
  getMyAvailability,
  updateMyAvailability,
  listMyBlocks,
  addBlock,
  removeBlock,
};
