// Historias clinicas: /api/medical-records  (AN-18, AN-19, AN-20, AN-21)
import api from "./api";
import { leerArchivo } from "./vetPanel.service";

// { pet, records, pendingAppointments? }  (pendingAppointments solo para el veterinario)
export async function obtenerHistoria(petId) {
  const respuesta = await api.get(`/medical-records/pets/${petId}`);
  return respuesta.data;
}

export async function crearEntrada(entrada) {
  const respuesta = await api.post("/medical-records", entrada);
  return respuesta.data;
}

export async function modificarEntrada(id, entrada) {
  const respuesta = await api.put(`/medical-records/${id}`, entrada);
  return respuesta.data;
}

export async function eliminarEntrada(id, reason) {
  const respuesta = await api.patch(`/medical-records/${id}/annul`, { reason });
  return respuesta.data;
}

// ---------- Adjuntos (examenes, radiografias) ----------

export const TIPOS_ADJUNTO = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_ADJUNTO_MB = 5;
export const MAX_ADJUNTOS = 10;

// Debe coincidir con los limites del backend.
export async function adjuntarArchivo(recordId, archivo) {
  const dataUrl = await leerArchivo(archivo);
  const respuesta = await api.post(`/medical-records/${recordId}/attachments`, { file: dataUrl, name: archivo.name });
  return respuesta.data;
}

export async function quitarAdjunto(id) {
  const respuesta = await api.delete(`/medical-records/attachments/${id}`);
  return respuesta.data;
}

// El archivo es privado: se pide con la sesion y se abre en otra pestana.
// La pestana se abre primero (con el clic) para que el navegador no la bloquee.
export async function abrirAdjunto(id) {
  const ventana = window.open("", "_blank");
  try {
    const respuesta = await api.get(`/medical-records/attachments/${id}`, { responseType: "blob" });
    const url = URL.createObjectURL(respuesta.data);
    if (ventana) {
      ventana.location.href = url;
    } else {
      window.location.assign(url);
    }
  } catch (error) {
    if (ventana) ventana.close();
    throw error;
  }
}

export function formatearTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
