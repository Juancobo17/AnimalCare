// Urgencias: /api/emergencies
import api from "./api";
import { ZONA_HORARIA } from "./zona";

// ---------- Dueño ----------

export async function disponibilidadUrgencias() {
  const respuesta = await api.get("/emergencies/availability");
  return respuesta.data; // { onDuty, home, clinic, ttlMinutes }
}

export async function pedirUrgencia(datos) {
  const respuesta = await api.post("/emergencies", datos);
  return respuesta.data;
}

export async function cancelarUrgencia(id) {
  const respuesta = await api.patch(`/emergencies/${id}/cancel`);
  return respuesta.data;
}

// Dueño: { active, emergencies }. Veterinario: las que acepto.
export async function misUrgencias() {
  const respuesta = await api.get("/emergencies/mine");
  return respuesta.data;
}

// ---------- Veterinario ----------

export async function estadoDeTurno() {
  const respuesta = await api.get("/emergencies/duty");
  return respuesta.data; // { active, until, hoursOptions, canGoOnDuty }
}

// hours: 4, 8 o 12; 0 para salir de turno.
export async function ponerseDeTurno(hours) {
  const respuesta = await api.put("/emergencies/duty", { hours });
  return respuesta.data;
}

export async function urgenciasAbiertas() {
  const respuesta = await api.get("/emergencies/open");
  return respuesta.data; // { onDuty, requests }
}

export async function aceptarUrgencia(id) {
  const respuesta = await api.patch(`/emergencies/${id}/accept`);
  return respuesta.data;
}

export async function completarUrgencia(id) {
  const respuesta = await api.patch(`/emergencies/${id}/complete`);
  return respuesta.data;
}

export async function liberarUrgencia(id) {
  const respuesta = await api.patch(`/emergencies/${id}/release`);
  return respuesta.data;
}

// ---------- Utilidades ----------

export const ESTADOS_URGENCIA = {
  OPEN: "Buscando veterinario",
  ACCEPTED: "En curso",
  COMPLETED: "Atendida",
  CANCELLED: "Cancelada",
  EXPIRED: "Sin respuesta",
};

// Cada cuanto se consulta el estado mientras la pantalla esta abierta.
export const INTERVALO_SONDEO_MS = 10_000;

// "hace menos de 1 min", "hace 7 min", "hace 1 h 5 min".
export function haceCuanto(fecha) {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 60000));
  if (minutos < 1) return "hace menos de 1 min";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `hace ${horas} h` : `hace ${horas} h ${resto} min`;
}

// Hora "03:45 p. m." en la zona de la clinica.
export function horaLocal(fecha) {
  return new Date(fecha).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA_HORARIA,
  });
}

// Debe coincidir con el backend.
export const MIN_SINTOMAS = 10;
export const MAX_SINTOMAS = 500;
export function telefonoValido(texto) {
  return /^[0-9+\s-]{7,15}$/.test(texto.trim());
}
