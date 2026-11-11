// Historias clinicas: /api/medical-records  (AN-18, AN-19, AN-20, AN-21)
import api from "./api";

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
