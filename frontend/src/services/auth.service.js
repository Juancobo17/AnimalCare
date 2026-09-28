// Operaciones de autenticacion contra la API y manejo de la sesion local.
import api from "./api";

// POST /api/auth/register
// datos lleva siempre name, email y password. Si el tipo de cuenta es
// VETERINARIAN, incluye ademas los datos profesionales (AN-7).
export async function registrar(datos) {
  const respuesta = await api.post("/auth/register", datos);
  return respuesta.data;
}

// POST /api/auth/login
// Si las credenciales son correctas, guarda el token y el usuario.
export async function iniciarSesion({ email, password }) {
  const respuesta = await api.post("/auth/login", { email, password });
  const { token, user } = respuesta.data;

  localStorage.setItem("token", token);
  localStorage.setItem("usuario", JSON.stringify(user));

  return respuesta.data;
}

// Cierra la sesion borrando los datos guardados en el navegador.
export function cerrarSesion() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
}

export function obtenerToken() {
  return localStorage.getItem("token");
}

export function obtenerUsuario() {
  const guardado = localStorage.getItem("usuario");
  if (!guardado) {
    return null;
  }
  try {
    return JSON.parse(guardado);
  } catch {
    return null;
  }
}

export function haySesionActiva() {
  return Boolean(obtenerToken());
}

// El rol decide que panel y que opciones ve la persona que inicio sesion.
export function esVeterinario() {
  return obtenerUsuario()?.role === "VETERINARIAN";
}
