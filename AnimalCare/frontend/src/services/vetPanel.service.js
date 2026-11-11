// Panel del veterinario: servicios (AN-28, AN-29, AN-30), horario y bloqueos (AN-31).
import api from "./api";

// ---------- Servicios ----------

export async function listarMisServicios() {
  const respuesta = await api.get("/vets/me/services");
  return respuesta.data; // { visible, services }
}

export async function agregarServicio(servicio) {
  const respuesta = await api.post("/vets/me/services", servicio);
  return respuesta.data;
}

export async function actualizarServicio(id, servicio) {
  const respuesta = await api.put(`/vets/me/services/${id}`, servicio);
  return respuesta.data;
}

export async function eliminarServicio(id) {
  const respuesta = await api.delete(`/vets/me/services/${id}`);
  return respuesta.data;
}

// ---------- Horario base ----------

export async function obtenerMiHorario() {
  const respuesta = await api.get("/vets/me/availability");
  return respuesta.data.availabilities;
}

export async function guardarMiHorario(franjas) {
  const respuesta = await api.put("/vets/me/availability", { availabilities: franjas });
  return respuesta.data;
}

// ---------- Bloqueos ----------

export async function listarMisBloqueos() {
  const respuesta = await api.get("/vets/me/blocks");
  return respuesta.data.blocks;
}

// Si hay citas en el rango y confirm es false, la API responde 409 con
// code BLOCK_CONFLICT y la lista de citas afectadas.
export async function crearBloqueo(bloqueo) {
  const respuesta = await api.post("/vets/me/blocks", bloqueo);
  return respuesta.data;
}

export async function eliminarBloqueo(id) {
  const respuesta = await api.delete(`/vets/me/blocks/${id}`);
  return respuesta.data;
}

// ---------- Perfil, foto y tarjeta profesional ----------

export async function obtenerMiPerfil() {
  const respuesta = await api.get("/vets/me/profile");
  return respuesta.data.profile;
}

export async function guardarMiPerfil(perfil) {
  const respuesta = await api.put("/vets/me/profile", perfil);
  return respuesta.data;
}

export async function subirFoto(dataUrl) {
  const respuesta = await api.put("/vets/me/photo", { image: dataUrl });
  return respuesta.data;
}

export async function quitarFoto() {
  const respuesta = await api.delete("/vets/me/photo");
  return respuesta.data;
}

export async function subirTarjetaProfesional(dataUrl) {
  const respuesta = await api.put("/vets/me/license-doc", { file: dataUrl });
  return respuesta.data;
}

// Lee un archivo elegido por el usuario como data URL.
export function leerArchivo(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.readAsDataURL(archivo);
  });
}
