// Controlador de citas.
//
// Agendamiento: AN-10 (a domicilio), AN-11 (en veterinaria), AN-13 (fecha y hora).
// Cancelacion por el cliente: AN-14.
// Agenda del veterinario: AN-15 (cancelar), AN-16 (modificar), AN-17 (ver por dia).
//
// El cliente se toma SIEMPRE de req.user.id, nunca del body: nadie puede
// agendar una cita a nombre de otra persona.
const appointmentService = require("../services/appointment.service");
const vetService = require("../services/vet.service");
const notificationService = require("../services/notification.service");
const { findOwnActivePet } = require("./pet.controller");
const prisma = require("../prisma");
const { parseId } = require("../utils/params");
const {
  parseDate,
  parseTime,
  combine,
  describeDateTime,
  DEFAULT_DURATION_MINUTES,
  MAX_SCHEDULE_DAYS,
} = require("../utils/schedule");

const { MODOS_VALIDOS, validateMode } = vetService;

const MAX_NOTES_LENGTH = 300;
const MAX_ADDRESS_LENGTH = 150;

// POST /api/appointments
async function createAppointment(req, res) {
  try {
    const { vetProfileId, serviceId, petId, mode, date, time, address, notes } = req.body || {};
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

    // La mascota es opcional; si se envia, debe ser una mascota activa del cliente.
    let pet = null;
    if (petId !== undefined && petId !== null && String(petId).trim() !== "") {
      const idMascota = parseId(petId);
      pet = idMascota ? await findOwnActivePet(idMascota, req.user.id) : null;
      if (!pet) {
        return res.status(404).json({ message: "La mascota no existe o no es tuya." });
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
      petId: pet ? pet.id : null,
      mode: modalidad,
      scheduledAt,
      durationMinutes,
      // La direccion del consultorio ya esta en el perfil del veterinario:
      // solo se guarda la del cliente cuando la atencion es a domicilio.
      address: modalidad === "HOME" ? direccion : null,
      notes: notas,
    });

    await avisar(
      appointment.vetProfile.user.id,
      `Nueva cita: ${req.user.name} agendó ${appointment.service ? appointment.service.name : "una consulta general"}` +
        `${pet ? ` para ${pet.name} (${pet.species})` : ""} ` +
        `para el ${describeDateTime(scheduledAt)} (${modalidad === "HOME" ? "a domicilio" : "en la veterinaria"}).`
    );

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
// Filtros opcionales: ?date=AAAA-MM-DD (AN-17) y ?status=PENDING|CONFIRMED|CANCELLED|COMPLETED
async function listMyAppointments(req, res) {
  try {
    const { date, status } = req.query;
    const errors = [];

    const fecha = date ? parseDate(date) : null;
    if (date && !fecha) {
      errors.push("La fecha no es valida (formato AAAA-MM-DD).");
    }
    const estado = status ? String(status).toUpperCase() : null;
    if (estado && !ESTADOS_CITA.includes(estado)) {
      errors.push(`El estado debe ser uno de: ${ESTADOS_CITA.join(", ")}.`);
    }
    if (errors.length > 0) {
      return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
    }

    const opciones = { date: fecha, status: estado };
    let appointments = [];

    if (req.user.role === "VETERINARIAN") {
      // Un veterinario sin perfil no deberia existir, pero si pasara
      // se responde una agenda vacia en vez de un error.
      appointments = req.user.vetProfile
        ? await appointmentService.findAppointmentsByVet(req.user.vetProfile.id, opciones)
        : [];
    } else {
      appointments = await appointmentService.findAppointmentsByClient(req.user.id, opciones);
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

// Estados desde los que una cita todavia se puede cancelar o modificar.
const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"];
const ESTADOS_CITA = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"];
const MAX_REASON_LENGTH = 200;

// Politica de cancelacion: el cliente puede cancelar hasta N horas antes.
// Despues de eso debe comunicarse con el veterinario, que si puede cancelar.
const CLIENT_CANCEL_MIN_HOURS = Number(process.env.CLIENT_CANCEL_MIN_HOURS ?? 2);

// Un aviso que falla no debe deshacer la accion principal.
async function avisar(userId, mensaje) {
  try {
    await notificationService.notify(userId, mensaje);
  } catch (error) {
    console.error("No se pudo crear la notificacion:", error);
  }
}

function esDeEsteUsuario(appointment, user) {
  if (user.role === "VETERINARIAN") {
    return Boolean(user.vetProfile) && appointment.vetProfileId === user.vetProfile.id;
  }
  return appointment.clientId === user.id;
}

// Busca la cita y comprueba que sea de quien hace la peticion.
// Una cita ajena se responde igual que una inexistente, para no revelar que existe.
// Devuelve la cita, o null si ya respondio con el error.
async function cargarCitaPropia(req, res) {
  const appointmentId = parseId(req.params.id);
  if (!appointmentId) {
    res.status(400).json({ message: "El identificador de la cita no es valido." });
    return null;
  }

  const appointment = await appointmentService.findAppointmentById(appointmentId);
  if (!appointment || !esDeEsteUsuario(appointment, req.user)) {
    res.status(404).json({ message: "La cita no existe." });
    return null;
  }
  return appointment;
}

// La cita que nace de una urgencia se gestiona desde Urgencias, no desde la agenda.
async function esDeUrgencia(res, appointment) {
  const urgencia = await prisma.emergencyRequest.findFirst({ where: { appointmentId: appointment.id }, select: { id: true } });
  if (!urgencia) return false;
  res.status(409).json({
    message: "Esta cita nació de una urgencia: se cierra o se libera desde la sección Urgencias.",
    code: "EMERGENCY_APPOINTMENT",
  });
  return true;
}

function motivoOpcional(body) {
  const texto = body?.reason === undefined || body?.reason === null ? "" : String(body.reason).trim();
  return texto;
}

function cuando(appointment) {
  return describeDateTime(appointment.scheduledAt);
}

// PATCH /api/appointments/:id/cancel
// AN-14: el cliente cancela una de sus citas proximas.
// AN-15: el veterinario cancela una cita de su agenda (motivo opcional).
// En ambos casos el horario queda libre y se avisa a la otra persona.
async function cancelAppointment(req, res) {
  try {
    const appointment = await cargarCitaPropia(req, res);
    if (!appointment) return undefined;
    if (await esDeUrgencia(res, appointment)) return undefined;

    const motivo = motivoOpcional(req.body);
    if (motivo.length > MAX_REASON_LENGTH) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors: [`El motivo no puede superar los ${MAX_REASON_LENGTH} caracteres.`],
      });
    }

    if (appointment.status === "CANCELLED") {
      return res.status(409).json({ message: "La cita ya estaba cancelada." });
    }
    if (appointment.status === "COMPLETED") {
      return res.status(409).json({ message: "No puedes cancelar una cita que ya fue atendida." });
    }
    if (appointment.scheduledAt.getTime() <= Date.now()) {
      return res.status(409).json({ message: "No puedes cancelar una cita cuya hora ya pasó." });
    }
    const faltanMs = appointment.scheduledAt.getTime() - Date.now();
    if (req.user.role === "CLIENT" && faltanMs < CLIENT_CANCEL_MIN_HOURS * 60 * 60 * 1000) {
      return res.status(409).json({
        message:
          `Solo puedes cancelar hasta ${CLIENT_CANCEL_MIN_HOURS} horas antes de la cita. ` +
          "Comunícate directamente con el veterinario.",
      });
    }

    const cancelada = await appointmentService.updateIfStatus(appointment.id, ACTIVE_STATUSES, {
      status: "CANCELLED",
    });
    if (!cancelada) {
      return res.status(409).json({ message: "La cita cambió de estado. Actualiza la página." });
    }

    const esVeterinario = req.user.role === "VETERINARIAN";
    if (esVeterinario) {
      await avisar(
        cancelada.clientId,
        `${req.user.name} canceló tu cita del ${cuando(cancelada)}.` +
          (motivo ? ` Motivo: ${motivo}.` : "") +
          " Puedes agendar otro horario."
      );
    } else {
      await avisar(cancelada.vetProfile.user.id, `${req.user.name} canceló su cita del ${cuando(cancelada)}.`);
    }

    return res.status(200).json({
      message: esVeterinario
        ? "La cita fue cancelada y se avisó al cliente."
        : "La cita fue cancelada. El horario quedó libre en la agenda del veterinario.",
      appointment: appointmentService.toPublicAppointment(cancelada),
    });
  } catch (error) {
    console.error("Error en cancelAppointment:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

// PATCH /api/appointments/:id/reschedule   body: { date, time, reason? }
// AN-16: el veterinario mueve una cita a otro horario libre de su agenda.
async function rescheduleAppointment(req, res) {
  try {
    const appointment = await cargarCitaPropia(req, res);
    if (!appointment) return undefined;
    if (await esDeUrgencia(res, appointment)) return undefined;

    const { date, time } = req.body || {};
    const motivo = motivoOpcional(req.body);
    const errors = [];

    const fecha = parseDate(date);
    if (!date || String(date).trim() === "") {
      errors.push("Debes elegir la nueva fecha.");
    } else if (!fecha) {
      errors.push("La fecha no es valida (formato AAAA-MM-DD).");
    }
    if (!time || String(time).trim() === "") {
      errors.push("Debes elegir la nueva hora.");
    } else if (parseTime(time) === null) {
      errors.push("La hora no es valida (formato HH:MM).");
    }
    if (motivo.length > MAX_REASON_LENGTH) {
      errors.push(`El motivo no puede superar los ${MAX_REASON_LENGTH} caracteres.`);
    }
    if (errors.length > 0) {
      return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
    }

    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      return res.status(409).json({ message: "Solo se pueden modificar citas pendientes o confirmadas." });
    }
    if (appointment.scheduledAt.getTime() <= Date.now()) {
      return res.status(409).json({ message: "No puedes modificar una cita cuya hora ya pasó." });
    }

    const nuevoInicio = combine(date, time);
    if (nuevoInicio.getTime() === appointment.scheduledAt.getTime()) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors: ["Elige una fecha u hora distinta a la actual."],
      });
    }
    if (nuevoInicio.getTime() <= Date.now()) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors: ["No puedes mover la cita a una fecha u hora que ya pasó."],
      });
    }
    if (nuevoInicio > new Date(Date.now() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000)) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors: [`Solo puedes mover la cita dentro de los proximos ${MAX_SCHEDULE_DAYS} dias.`],
      });
    }

    // Debe caer dentro del horario de atencion y estar libre (sin contar esta misma cita).
    const vetProfile = await vetService.findVetById(appointment.vetProfileId);
    const horario = vetProfile
      ? vetService.buildScheduleSlots(vetProfile, fecha, appointment.durationMinutes)
      : [];
    if (!horario.includes(String(time).trim())) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors: ["Ese horario está fuera de tu horario de atención."],
      });
    }
    const libre = await vetService.isSlotFree(
      appointment.vetProfileId,
      nuevoInicio,
      appointment.durationMinutes,
      appointment.id
    );
    if (!libre) {
      return res.status(409).json({ message: "Ese horario ya está ocupado o bloqueado. Elige otro." });
    }

    const anterior = cuando(appointment);
    const movida = await appointmentService.updateIfStatus(appointment.id, ACTIVE_STATUSES, {
      scheduledAt: nuevoInicio,
    });
    if (!movida) {
      return res.status(409).json({ message: "La cita cambió de estado. Actualiza la página." });
    }

    await avisar(
      movida.clientId,
      `${req.user.name} cambió tu cita del ${anterior} para el ${cuando(movida)}.` +
        (motivo ? ` Motivo: ${motivo}.` : "")
    );

    return res.status(200).json({
      message: "La cita fue reprogramada y se avisó al cliente.",
      appointment: appointmentService.toPublicAppointment(movida),
    });
  } catch (error) {
    console.error("Error en rescheduleAppointment:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

// PATCH /api/appointments/:id/confirm
// AN-16: el veterinario confirma una cita pendiente.
async function confirmAppointment(req, res) {
  try {
    const appointment = await cargarCitaPropia(req, res);
    if (!appointment) return undefined;
    if (await esDeUrgencia(res, appointment)) return undefined;

    if (appointment.status !== "PENDING") {
      return res.status(409).json({ message: "Solo se pueden confirmar citas pendientes." });
    }
    if (appointment.scheduledAt.getTime() <= Date.now()) {
      return res.status(409).json({ message: "No puedes confirmar una cita cuya hora ya pasó." });
    }

    const confirmada = await appointmentService.updateIfStatus(appointment.id, ["PENDING"], {
      status: "CONFIRMED",
    });
    if (!confirmada) {
      return res.status(409).json({ message: "La cita cambió de estado. Actualiza la página." });
    }

    await avisar(confirmada.clientId, `${req.user.name} confirmó tu cita del ${cuando(confirmada)}.`);

    return res.status(200).json({
      message: "Cita confirmada. Se avisó al cliente.",
      appointment: appointmentService.toPublicAppointment(confirmada),
    });
  } catch (error) {
    console.error("Error en confirmAppointment:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

// PATCH /api/appointments/:id/complete
// AN-16: despues de la hora de la cita, el veterinario la marca como atendida.
async function completeAppointment(req, res) {
  try {
    const appointment = await cargarCitaPropia(req, res);
    if (!appointment) return undefined;
    if (await esDeUrgencia(res, appointment)) return undefined;

    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      return res.status(409).json({ message: "Solo se pueden completar citas pendientes o confirmadas." });
    }
    if (appointment.scheduledAt.getTime() > Date.now()) {
      return res.status(409).json({ message: "Solo puedes marcar como atendida una cita cuya hora ya llegó." });
    }

    const completada = await appointmentService.updateIfStatus(appointment.id, ACTIVE_STATUSES, {
      status: "COMPLETED",
    });
    if (!completada) {
      return res.status(409).json({ message: "La cita cambió de estado. Actualiza la página." });
    }

    return res.status(200).json({
      message: "Cita marcada como atendida.",
      appointment: appointmentService.toPublicAppointment(completada),
    });
  } catch (error) {
    console.error("Error en completeAppointment:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

const MAX_COMMENT_LENGTH = 500;

// POST /api/appointments/:id/review   body: { rating: 1..5, comment? }
// El cliente califica una cita suya que ya fue atendida. Una vez por cita.
// El promedio del veterinario se recalcula en la misma transaccion.
async function reviewAppointment(req, res) {
  try {
    const appointment = await cargarCitaPropia(req, res);
    if (!appointment) return undefined;

    const rating = Number(req.body?.rating);
    const comentario = req.body?.comment === undefined || req.body?.comment === null ? "" : String(req.body.comment).trim();
    const errors = [];
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      errors.push("La calificación debe ser un número entero de 1 a 5.");
    }
    if (comentario.length > MAX_COMMENT_LENGTH) {
      errors.push(`El comentario no puede superar los ${MAX_COMMENT_LENGTH} caracteres.`);
    }
    if (errors.length > 0) {
      return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
    }

    if (appointment.status !== "COMPLETED") {
      return res.status(409).json({ message: "Solo puedes calificar una cita que ya fue atendida." });
    }
    if (appointment.review) {
      return res.status(409).json({ message: "Ya calificaste esta cita." });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.review.create({
          data: {
            rating,
            comment: comentario === "" ? null : comentario,
            appointmentId: appointment.id,
            clientId: req.user.id,
            vetProfileId: appointment.vetProfileId,
          },
        });
        const promedio = await tx.review.aggregate({
          where: { vetProfileId: appointment.vetProfileId },
          _avg: { rating: true },
        });
        await tx.vetProfile.update({
          where: { id: appointment.vetProfileId },
          data: { rating: Math.round(promedio._avg.rating * 10) / 10 },
        });
      });
    } catch (error) {
      // Dos envios casi simultaneos: la base rechaza la segunda resena.
      if (error && error.code === "P2002") {
        return res.status(409).json({ message: "Ya calificaste esta cita." });
      }
      throw error;
    }

    await avisar(
      appointment.vetProfile.user.id,
      `${req.user.name} calificó con ${rating} de 5 su cita del ${cuando(appointment)}.`
    );

    const actualizada = await appointmentService.findAppointmentById(appointment.id);
    return res.status(201).json({
      message: "¡Gracias por tu calificación!",
      appointment: appointmentService.toPublicAppointment(actualizada),
    });
  } catch (error) {
    console.error("Error en reviewAppointment:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

module.exports = {
  reviewAppointment,
  createAppointment,
  listMyAppointments,
  cancelAppointment,
  rescheduleAppointment,
  confirmAppointment,
  completeAppointment,
};
