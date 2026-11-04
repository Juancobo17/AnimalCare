// Controlador de veterinarios.
//
// Cubre AN-26 (ver el perfil detallado y los servicios del veterinario)
// y la parte de consulta de AN-13 (que horarios estan libres).
const vetService = require("../services/vet.service");
const { parseId } = require("../utils/params");
const { parseDate, DEFAULT_DURATION_MINUTES, MAX_SCHEDULE_DAYS } = require("../utils/schedule");

const { MODOS_VALIDOS, validateMode } = vetService;

// GET /api/vets
// Filtros opcionales: ?specialty=texto y ?mode=HOME|CLINIC
async function listVets(req, res) {
  try {
    const { specialty, mode } = req.query;

    if (mode !== undefined && !MODOS_VALIDOS.includes(String(mode))) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors: [`La modalidad debe ser ${MODOS_VALIDOS.join(" o ")}.`],
      });
    }

    const vets = await vetService.findVets({
      specialty: specialty ? String(specialty).trim() : undefined,
      mode,
    });

    return res.status(200).json({
      total: vets.length,
      vets: vets.map(vetService.toPublicVetSummary),
    });
  } catch (error) {
    console.error("Error en listVets:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

// GET /api/vets/:id
// Perfil detallado con servicios y horario semanal (AN-26).
async function getVet(req, res) {
  try {
    const vetProfileId = parseId(req.params.id);
    if (!vetProfileId) {
      return res.status(400).json({ message: "El identificador del veterinario no es valido." });
    }

    const vetProfile = await vetService.findVetById(vetProfileId);
    if (!vetProfile) {
      return res.status(404).json({ message: "El veterinario no existe." });
    }

    return res.status(200).json({ vet: vetService.toPublicVetDetail(vetProfile) });
  } catch (error) {
    console.error("Error en getVet:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

// GET /api/vets/:id/slots?date=AAAA-MM-DD&mode=HOME|CLINIC&serviceId=1
// Horarios libres de un veterinario para un dia concreto (AN-13).
async function getSlots(req, res) {
  try {
    const vetProfileId = parseId(req.params.id);
    if (!vetProfileId) {
      return res.status(400).json({ message: "El identificador del veterinario no es valido." });
    }

    const { date, mode, serviceId } = req.query;
    const errors = [];

    const fecha = parseDate(date);
    if (!date || String(date).trim() === "") {
      errors.push("Debes indicar la fecha que quieres consultar.");
    } else if (!fecha) {
      errors.push("La fecha no es valida (formato AAAA-MM-DD).");
    }

    if (mode !== undefined && !MODOS_VALIDOS.includes(String(mode))) {
      errors.push(`La modalidad debe ser ${MODOS_VALIDOS.join(" o ")}.`);
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
    }

    // No tiene sentido consultar la agenda de un dia que ya paso.
    const hoy = parseDate(new Date().toISOString().slice(0, 10));
    const limite = new Date(hoy.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000);

    if (fecha < hoy) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors: ["No puedes consultar horarios de una fecha que ya paso."],
      });
    }
    if (fecha > limite) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors: [`Solo puedes consultar la agenda de los proximos ${MAX_SCHEDULE_DAYS} dias.`],
      });
    }

    const vetProfile = await vetService.findVetById(vetProfileId);
    if (!vetProfile) {
      return res.status(404).json({ message: "El veterinario no existe." });
    }

    // La modalidad es opcional al consultar, pero si se envia debe ser
    // una que el profesional realmente ofrezca.
    if (mode) {
      const errorModalidad = validateMode(vetProfile, String(mode));
      if (errorModalidad) {
        return res.status(400).json({
          message: "Los datos enviados no son validos.",
          errors: [errorModalidad],
        });
      }
    }

    // La duracion de la cita depende del servicio elegido.
    let durationMinutes = DEFAULT_DURATION_MINUTES;
    if (serviceId !== undefined && String(serviceId).trim() !== "") {
      const id = parseId(serviceId);
      if (!id) {
        return res.status(400).json({
          message: "Los datos enviados no son validos.",
          errors: ["El identificador del servicio no es valido."],
        });
      }

      const service = await vetService.findServiceOfVet(vetProfileId, id);
      if (!service) {
        return res.status(404).json({ message: "El servicio no existe o no pertenece a este veterinario." });
      }

      durationMinutes = service.durationMinutes;
    }

    const slots = await vetService.findAvailableSlots(vetProfile, fecha, durationMinutes);

    return res.status(200).json({
      date: String(date).trim(),
      mode: mode ? String(mode) : null,
      durationMinutes,
      total: slots.length,
      slots,
    });
  } catch (error) {
    console.error("Error en getSlots:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

module.exports = { listVets, getVet, getSlots };
