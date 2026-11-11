// Consultas de veterinarios: listado, perfil detallado (AN-26)
// y horarios disponibles (AN-13).
import api from "./api";
import { hoyLocal, sumarDias } from "./zona";

// GET /api/vets
// q busca por nombre del profesional, especialidad o servicio (AN-27).
// zone (barrio o ciudad), maxPrice, today ("atiende hoy") y sort (next|price|rating).
export async function listarVeterinarios({ q, specialty, mode, zone, maxPrice, today, sort } = {}) {
  const params = {};
  if (zone) params.zone = zone;
  if (maxPrice) params.maxPrice = maxPrice;
  if (today) params.today = "true";
  if (sort) params.sort = sort;
  if (q) {
    params.q = q;
  }
  if (specialty) {
    params.specialty = specialty;
  }
  if (mode) {
    params.mode = mode;
  }

  const respuesta = await api.get("/vets", { params });
  return respuesta.data.vets;
}

// GET /api/vets/:id
export async function obtenerVeterinario(id) {
  const respuesta = await api.get(`/vets/${id}`);
  return respuesta.data.vet;
}

// GET /api/vets/:id/slots?date=&mode=&serviceId=
// Devuelve las horas libres de ese dia, por ejemplo ["09:00", "09:30"].
export async function obtenerHorarios(id, { date, mode, serviceId } = {}) {
  const params = { date };
  if (mode) {
    params.mode = mode;
  }
  if (serviceId) {
    params.serviceId = serviceId;
  }

  const respuesta = await api.get(`/vets/${id}/slots`, { params });
  return respuesta.data;
}

// Etiquetas de las modalidades de atencion (AN-10 y AN-11).
export const MODALIDADES = {
  HOME: "A domicilio",
  CLINIC: "En la veterinaria",
};

// Nombre de los dias de la semana, en el orden que usa la API (0 = domingo).
export const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

// Formatea un precio como moneda local.
export function formatearPrecio(precio) {
  return Number(precio).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

// GET /api/vets/:id/days?mode=&serviceId=
// Proximos 14 dias con la cantidad de turnos libres: [{ date, available }].
export async function obtenerDiasDisponibles(id, { mode, serviceId } = {}) {
  const params = {};
  if (mode) params.mode = mode;
  if (serviceId) params.serviceId = serviceId;
  const respuesta = await api.get(`/vets/${id}/days`, { params });
  return respuesta.data.days;
}

// Las fotos subidas llegan como "/uploads/photos/...": se sirven desde el
// mismo servidor que la API, no desde el frontend.
export function urlDeFoto(url) {
  if (!url || !url.startsWith("/uploads/")) return url;
  const base = import.meta.env.VITE_API_URL || "/api";
  return base.replace(/\/api\/?$/, "") + url;
}

// "Hoy 15:00", "Mañana 09:00" o "jue 19 nov · 09:00" (fechas en UTC como la API).
export function describirTurno(turno) {
  if (!turno) return null;
  const hoy = hoyLocal();
  const manana = sumarDias(hoy, 1);
  if (turno.date === hoy) return `Hoy ${turno.time}`;
  if (turno.date === manana) return `Mañana ${turno.time}`;
  const fecha = new Date(`${turno.date}T12:00:00Z`).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `${fecha} · ${turno.time}`;
}
