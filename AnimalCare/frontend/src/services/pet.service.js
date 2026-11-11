// Mascotas del dueño: /api/pets
import api from "./api";

export async function listarMascotas() {
  const respuesta = await api.get("/pets");
  return respuesta.data; // { pets, species }
}

export async function registrarMascota(mascota) {
  const respuesta = await api.post("/pets", mascota);
  return respuesta.data;
}

export async function actualizarMascota(id, mascota) {
  const respuesta = await api.put(`/pets/${id}`, mascota);
  return respuesta.data;
}

export async function desactivarMascota(id) {
  const respuesta = await api.delete(`/pets/${id}`);
  return respuesta.data;
}

export const ESPECIES = ["Perro", "Gato", "Ave", "Conejo", "Roedor", "Reptil", "Otro"];
export const ICONO_ESPECIE = { Perro: "🐶", Gato: "🐱", Ave: "🐦", Conejo: "🐰", Roedor: "🐹", Reptil: "🦎", Otro: "🐾" };

// "3 años", "8 meses" a partir de "AAAA-MM-DD".
export function calcularEdad(fechaNacimiento) {
  const nacimiento = new Date(`${fechaNacimiento}T00:00:00Z`);
  const hoy = new Date();
  let meses = (hoy.getUTCFullYear() - nacimiento.getUTCFullYear()) * 12 + (hoy.getUTCMonth() - nacimiento.getUTCMonth());
  if (hoy.getUTCDate() < nacimiento.getUTCDate()) meses -= 1;
  if (meses < 1) return "menos de 1 mes";
  if (meses < 12) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anios = Math.floor(meses / 12);
  return `${anios} ${anios === 1 ? "año" : "años"}`;
}
