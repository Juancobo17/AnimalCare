// Agendamiento de citas (AN-10, AN-11 y AN-13).
import api from "./api";

// POST /api/appointments
export async function agendarCita({ vetProfileId, serviceId, mode, date, time, address, notes }) {
  const respuesta = await api.post("/appointments", {
    vetProfileId,
    serviceId: serviceId || null,
    mode,
    date,
    time,
    address: address || null,
    notes: notes || null,
  });

  return respuesta.data;
}

// GET /api/appointments
// El backend decide que devolver segun el rol: el cliente ve las citas que
// agendo y el veterinario las que le agendaron.
export async function listarMisCitas() {
  const respuesta = await api.get("/appointments");
  return respuesta.data.appointments;
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
