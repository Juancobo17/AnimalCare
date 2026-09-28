// Controlador de citas.
//
// Reune las tres historias de agendamiento del sprint:
// AN-10 (atencion a domicilio), AN-11 (atencion en veterinaria)
// y AN-13 (escoger fecha y hora).
//
// El cliente se toma SIEMPRE de req.user.id, nunca del body: nadie puede
// agendar una cita a nombre de otra persona.
const appointmentService = require("../services/appointment.service");
const vetService = require("../services/vet.service");
const { parseId } = require("../utils/params");
const {
  parseDate,
  parseTime,
  combine,
  DEFAULT_DURATION_MINUTES,
  MAX_SCHEDULE_DAYS,
} = require("../utils/schedule");

const { MODOS_VALIDOS, validateMode } = vetService;

const MAX_NOTES_LENGTH = 300;
const MAX_ADDRESS_LENGTH = 150;

// POST /api/appointments
async function createAppointment(req, res) {
  try {
    const { vetProfileId, serviceId, mode, date, time, address, notes } = req.body || {};
    const errors = [];

    // --- Validaciones de formato ---

    const idVeterinario = parseId(vetProfileId);
    if (!idVeterinario) {
      errors.push("Debes elegir un veterinario.");
    }

    const modalidad = String(mode ?? "").trim().toUpperCase();
    if (modalidad === "") {
      errors.push("Debes elegir la modalidad de atencion.");
    } else if (!MODOS_VALIDOS.includes(modalidad)) {
      errors.push(`La modalidad debe ser ${MODOS_VALIDOS.join(" o ")}.`);
    }

    const fecha = parseDate(date);
    if (!date || String(date).trim() === "") {
      errors.push("Debes elegir la fecha de la cita.");
    } else if (!fecha) {
      errors.push("La fecha no es valida (formato AAAA-MM-DD).");
    }

    if (!time || String(time).trim() === "") {
      errors.push("Debes elegir la hora de la cita.");
    } else if (parseTime(time) === null) {
      errors.push("La hora no es valida (formato HH:MM).");
    }

    const notas = notes === undefined || notes === null ? null : String(notes).trim() || null;
    if (notas && notas.length > MAX_NOTES_LENGTH) {
      errors.push(`Las notas no pueden superar los ${MAX_NOTES_LENGTH} caracteres.`);
    }

    const direccion = address === undefined || address === null ? null : String(address).trim() || null;
    if (direccion && direccion.length > MAX_ADDRESS_LENGTH) {
      errors.push(`La direccion no puede superar los ${MAX_ADDRESS_LENGTH} caracteres.`);
    }

    // La atencion a domicilio necesita saber a donde ir (AN-10).
    if (modalidad === "HOME" && !direccion) {
      errors.push("Debes indicar la direccion donde se atendera a la mascota.");
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
    }

    // --- Validaciones contra la base de datos ---

    const vetProfile = await vetService.findVetById(idVeterinario);
    if (!vetProfile) {
      return res.status(404).json({ message: "El veterinario no existe." });
    }

    // El veterinario debe ofrecer la modalidad elegida (AN-10 / AN-11).
    const errorModalidad = validateMode(vetProfile, modalidad);
    if (errorModalidad) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors: [errorModalidad],
      });
    }

    // El servicio es opcional; si se envia, debe ser de este veterinario.
    let service = null;
    if (serviceId !== undefined && serviceId !== null && String(serviceId).trim() !== "") {
      const idServicio = parseId(serviceId);
      if (!idServicio) {
        return res.status(400).json({
          message: "Los datos enviados no son validos.",
          errors: ["El identificador del servicio no es valido."],
        });
      }

      service = await vetService.findServiceOfVet(idVeterinario, idServicio);
      if (!service) {
        return res.status(404).json({ message: "El servicio no existe o no pertenece a este veterinario." });
      }
    }

    const durationMinutes = service ? service.durationMinutes : DEFAULT_DURATION_MINUTES;
    const scheduledAt = combine(date, time);

    // La cita no puede quedar en el pasado.
    if (scheduledAt.getTime() <= Date.now()) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors: ["No puedes agendar una cita en una fecha u hora que ya paso."],
      });
    }

    const limite = new Date(Date.now() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000);
    if (scheduledAt > limite) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors: [`Solo puedes agendar citas dentro de los proximos ${MAX_SCHEDULE_DAYS} dias.`],
      });
    }

    const hora = String(time).trim();

    // La hora elegida debe caer dentro del horario de atencion del veterinario
    // y respetar los bloques de la agenda.
    const horarioDelDia = vetService.buildScheduleSlots(vetProfile, fecha, durationMinutes);
    if (!horarioDelDia.includes(hora)) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors: ["El veterinario no atiende ese dia a esa hora. Elige un horario de su agenda."],
      });
    }

    // Si atiende pero el bloque no aparece libre, es porque ya esta tomado.
    const slots = await vetService.findAvailableSlots(vetProfile, fecha, durationMinutes);
    if (!slots.includes(hora)) {
      return res.status(409).json({
        message: "El horario elegido ya no esta disponible. Elige otro.",
      });
    }

    // Ultima comprobacion antes de guardar, por si otro cliente tomo el mismo
    // horario mientras esta persona llenaba el formulario.
    const libre = await vetService.isSlotFree(idVeterinario, scheduledAt, durationMinutes);
    if (!libre) {
      return res.status(409).json({
        message: "El horario elegido ya no esta disponible. Elige otro.",
      });
    }

    const appointment = await appointmentService.createAppointment({
      clientId: req.user.id,
      vetProfileId: idVeterinario,
      serviceId: service ? service.id : null,
      mode: modalidad,
      scheduledAt,
      durationMinutes,
      // La direccion del consultorio ya esta en el perfil del veterinario:
      // solo se guarda la del cliente cuando la atencion es a domicilio.
      address: modalidad === "HOME" ? direccion : null,
      notes: notas,
    });

    return res.status(201).json({
      message: "La cita fue agendada correctamente.",
      appointment: appointmentService.toPublicAppointment(appointment),
    });
  } catch (error) {
    console.error("Error en createAppointment:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

// GET /api/appointments
// Cada usuario ve solo sus citas: el cliente las que agendo,
// el veterinario las que le agendaron.
async function listMyAppointments(req, res) {
  try {
    let appointments = [];

    if (req.user.role === "VETERINARIAN") {
      // Un veterinario sin perfil no deberia existir, pero si pasara
      // se responde una agenda vacia en vez de un error.
      appointments = req.user.vetProfile
        ? await appointmentService.findAppointmentsByVet(req.user.vetProfile.id)
        : [];
    } else {
      appointments = await appointmentService.findAppointmentsByClient(req.user.id);
    }

    return res.status(200).json({
      total: appointments.length,
      appointments: appointments.map(appointmentService.toPublicAppointment),
    });
  } catch (error) {
    console.error("Error en listMyAppointments:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

module.exports = { createAppointment, listMyAppointments };
