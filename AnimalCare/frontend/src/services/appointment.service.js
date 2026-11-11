// Citas: agendamiento (AN-10, AN-11, AN-13), cancelacion (AN-14, AN-15)
// y gestion de la agenda del veterinario (AN-16, AN-17).
import api from "./api";

// POST /api/appointments
export async function agendarCita({ vetProfileId, serviceId, petId, mode, date, time, address, notes }) {
  const respuesta = await api.post("/appointments", {
    vetProfileId,
    serviceId: serviceId || null,
    petId: petId || null,
    mode,
    date,
    time,
    address: address || null,
    notes: notes || null,
  });

  return respuesta.data;
}

// GET /api/appointments?date=&status=
// El backend decide que devolver segun el rol: el cliente ve las citas que
// agendo y el veterinario las que le agendaron. date filtra un dia (AN-17).
export async function listarMisCitas({ date, status } = {}) {
  const params = {};
  if (date) params.date = date;
  if (status) params.status = status;
  const respuesta = await api.get("/appointments", { params });
  return respuesta.data.appointments;
}

// PATCH /api/appointments/:id/cancel  (AN-14 cliente, AN-15 veterinario)
export async function cancelarCita(id, reason) {
  const respuesta = await api.patch(`/appointments/${id}/cancel`, reason ? { reason } : {});
  return respuesta.data;
}

// PATCH /api/appointments/:id/reschedule  (AN-16)
export async function reprogramarCita(id, { date, time, reason }) {
  const respuesta = await api.patch(`/appointments/${id}/reschedule`, { date, time, reason });
  return respuesta.data;
}

// PATCH /api/appointments/:id/confirm  (AN-16)
export async function confirmarCita(id) {
  const respuesta = await api.patch(`/appointments/${id}/confirm`);
  return respuesta.data;
}

// PATCH /api/appointments/:id/complete  (AN-16)
export async function completarCita(id) {
  const respuesta = await api.patch(`/appointments/${id}/complete`);
  return respuesta.data;
}

// POST /api/appointments/:id/review  (resena despues de una cita atendida)
export async function calificarCita(id, { rating, comment }) {
  const respuesta = await api.post(`/appointments/${id}/review`, { rating, comment });
  return respuesta.data;
}

// Debe coincidir con CLIENT_CANCEL_MIN_HOURS del backend.
export const HORAS_MINIMAS_CANCELACION = 2;

// El cliente puede cancelar hasta N horas antes; despues, solo el veterinario.
export function clientePuedeCancelar(cita) {
  return (
    esActiva(cita) &&
    inicioDeCita(cita).getTime() - Date.now() >= HORAS_MINIMAS_CANCELACION * 60 * 60 * 1000
  );
}

// Momento de inicio de la cita. Igual que el backend, se interpreta en UTC.
export function inicioDeCita(cita) {
  return new Date(`${cita.date}T${cita.time}:00Z`);
}

export function esActiva(cita) {
  return cita.status === "PENDING" || cita.status === "CONFIRMED";
}

// Una cita se puede cancelar o modificar si sigue activa y su hora no ha pasado.
export function esCancelable(cita) {
  return esActiva(cita) && inicioDeCita(cita).getTime() > Date.now();
}

// Se puede marcar como atendida cuando su hora ya llego.
export function esCompletable(cita) {
  return esActiva(cita) && inicioDeCita(cita).getTime() <= Date.now();
}

// Fecha de hoy "AAAA-MM-DD" con el mismo criterio UTC de la API.
export function hoyUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Suma dias a una fecha "AAAA-MM-DD".
export function sumarDias(fecha, dias) {
  const valor = new Date(`${fecha}T00:00:00Z`);
  valor.setUTCDate(valor.getUTCDate() + dias);
  return valor.toISOString().slice(0, 10);
}

// Etiquetas de los estados de una cita.
export const ESTADOS_CITA = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
};

// Convierte "2026-09-23" en "miércoles, 23 de septiembre de 2026".
// Se agrega la hora en UTC porque la API trabaja siempre en UTC:
// sin eso, el navegador podria mostrar el dia anterior.
export function formatearFecha(fecha) {
  const valor = new Date(`${fecha}T12:00:00Z`);

  return valor.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
