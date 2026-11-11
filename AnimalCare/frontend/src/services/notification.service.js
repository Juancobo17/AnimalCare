// Notificaciones del usuario (AN-22, AN-23).
import api from "./api";

export async function listarNotificaciones() {
  const respuesta = await api.get("/notifications");
  return respuesta.data; // { unread, notifications }
}

export async function marcarNotificacionLeida(id) {
  await api.patch(`/notifications/${id}/read`);
}

export async function marcarTodasLeidas() {
  await api.patch("/notifications/read-all");
}

export function formatearMomento(fecha) {
  return new Date(fecha).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
