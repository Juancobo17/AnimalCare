// Controlador de veterinarios.
//
// Cubre AN-26 (ver el perfil detallado y los servicios del veterinario)
// y la parte de consulta de AN-13 (que horarios estan libres).
const vetService = require("../services/vet.service");
const { parseId } = require("../utils/params");
const {
  parseDate,
  startOfDay,
  addDays,
  toDateString,
  DEFAULT_DURATION_MINUTES,
  MAX_SCHEDULE_DAYS,
} = require("../utils/schedule");

const { MODOS_VALIDOS, validateMode } = vetService;

// Largo maximo del texto de busqueda.
const MAX_QUERY_LENGTH = 60;

// Dias hacia adelante en que se busca el proximo turno libre.
const NEXT_SLOT_DAYS = 14;
const ORDENES = ["next", "price", "rating"];

// GET /api/vets
// Filtros opcionales:
//   ?q=texto         nombre, especialidad o servicio (AN-27)
//   ?specialty=texto solo especialidad
//   ?mode=HOME|CLINIC
//   ?zone=texto      barrio o ciudad del consultorio
//   ?maxPrice=numero con algun servicio de ese valor o menos
//   ?today=true      con algun turno libre hoy
//   ?sort=next|price|rating
// Cada veterinario trae nextSlot: su proximo turno libre en 14 dias.
async function listVets(req, res) {
  try {
    const { q, specialty, mode, zone, maxPrice, today, sort } = req.query;
    const texto = q === undefined ? "" : String(q).trim();
    const zona = zone === undefined ? "" : String(zone).trim();
    const errores = [];

    if (texto.length > MAX_QUERY_LENGTH) {
      errores.push(`La busqueda no puede superar los ${MAX_QUERY_LENGTH} caracteres.`);
    }
    if (zona.length > MAX_QUERY_LENGTH) {
      errores.push(`La zona no puede superar los ${MAX_QUERY_LENGTH} caracteres.`);
    }
    const precioMaximo = maxPrice === undefined || maxPrice === "" ? null : Number(maxPrice);
    if (precioMaximo !== null && !(precioMaximo > 0)) {
      errores.push("El precio máximo debe ser un número mayor a cero.");
    }
    if (sort !== undefined && !ORDENES.includes(String(sort))) {
      errores.push(`El orden debe ser uno de: ${ORDENES.join(", ")}.`);
    }
    if (errores.length > 0) {
      return res.status(400).json({ message: "Los datos enviados no son validos.", errors: errores });
    }

    if (mode !== undefined && !MODOS_VALIDOS.includes(String(mode))) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors: [`La modalidad debe ser ${MODOS_VALIDOS.join(" o ")}.`],
      });
    }

    const vets = await vetService.findVets({
      q: texto || undefined,
      specialty: specialty ? String(specialty).trim() : undefined,
      mode,
      zone: zona || undefined,
      maxPrice: precioMaximo || undefined,
    });

    // Proximo turno libre de cada uno, con dos consultas para todos.
    const ahora = new Date();
    const desde = startOfDay(ahora);
    const hasta = addDays(desde, NEXT_SLOT_DAYS);
    const ocupados = await vetService.findBusyByVet(vets.map((v) => v.id), desde, hasta);

    let lista = vets.map((vet) => ({
      ...vetService.toPublicVetSummary(vet),
      nextSlot: vetService.firstFreeSlot(vet, ocupados.get(vet.id), { dias: NEXT_SLOT_DAYS, now: ahora }),
    }));

    if (today === "true") {
      const hoy = toDateString(desde);
      lista = lista.filter((vet) => vet.nextSlot && vet.nextSlot.date === hoy);
    }

    // Los que no tienen dato (sin turnos, sin precio, sin calificacion) van al final.
    const claves = {
      next: (v) => (v.nextSlot ? `${v.nextSlot.date}T${v.nextSlot.time}` : "~"),
      price: (v) => (v.minPrice === null ? Infinity : v.minPrice),
      rating: (v) => (v.rating === null ? 1 : -v.rating),
    };
    if (sort) {
      const clave = claves[sort];
      lista = [...lista].sort((a, b) => (clave(a) < clave(b) ? -1 : clave(a) > clave(b) ? 1 : 0));
    }

    return res.status(200).json({ total: lista.length, vets: lista });
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

// GET /api/vets/:id/days?mode=HOME|CLINIC&serviceId=1
// Los proximos 14 dias con la cantidad de turnos libres de cada uno, para
// que el cliente elija un dia con disponibilidad sin probar fecha por fecha.
async function getDays(req, res) {
  try {
    const vetProfileId = parseId(req.params.id);
    if (!vetProfileId) {
      return res.status(400).json({ message: "El identificador del veterinario no es valido." });
    }
    const { mode, serviceId } = req.query;
    if (mode !== undefined && !MODOS_VALIDOS.includes(String(mode))) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors: [`La modalidad debe ser ${MODOS_VALIDOS.join(" o ")}.`],
      });
    }

    const vetProfile = await vetService.findVetById(vetProfileId);
    if (!vetProfile) {
      return res.status(404).json({ message: "El veterinario no existe." });
    }
    if (mode) {
      const errorModalidad = validateMode(vetProfile, String(mode));
      if (errorModalidad) {
        return res.status(400).json({ message: "Los datos enviados no son validos.", errors: [errorModalidad] });
      }
    }

    let durationMinutes = DEFAULT_DURATION_MINUTES;
    if (serviceId !== undefined && serviceId !== "") {
      const idServicio = parseId(serviceId);
      const servicio = idServicio ? await vetService.findServiceOfVet(vetProfileId, idServicio) : null;
      if (!servicio) {
        return res.status(404).json({ message: "El servicio no existe o no pertenece a este veterinario." });
      }
      durationMinutes = servicio.durationMinutes;
    }

    const ahora = new Date();
    const desde = startOfDay(ahora);
    const hasta = addDays(desde, NEXT_SLOT_DAYS);
    const ocupados = await vetService.findBusyByVet([vetProfileId], desde, hasta);
    const dias = vetService.slotsByDay(vetProfile, ocupados.get(vetProfileId), {
      dias: NEXT_SLOT_DAYS,
      durationMinutes,
      now: ahora,
    });

    return res.status(200).json({
      days: dias.map((d) => ({ date: d.date, available: d.slots.length })),
    });
  } catch (error) {
    console.error("Error en getDays:", error);
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
    const hoy = startOfDay();
    const limite = addDays(hoy, MAX_SCHEDULE_DAYS);

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

module.exports = { listVets, getVet, getSlots, getDays };
