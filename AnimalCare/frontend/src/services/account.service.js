// Cuenta: recuperar contrasena, verificar correo, editar datos y eliminar la cuenta.
import api from "./api";

export async function solicitarRecuperacion(email) {
  const respuesta = await api.post("/auth/forgot-password", { email });
  return respuesta.data;
}

export async function restablecerContrasena(token, password) {
  const respuesta = await api.post("/auth/reset-password", { token, password });
  return respuesta.data;
}

export async function verificarCorreo(token) {
  const respuesta = await api.post("/auth/verify-email", { token });
  return respuesta.data;
}

export async function reenviarVerificacion() {
  const respuesta = await api.post("/account/resend-verification");
  return respuesta.data;
}

export async function actualizarCuenta(datos) {
  const respuesta = await api.put("/account", datos);
  return respuesta.data;
}

export async function cambiarContrasena(currentPassword, newPassword) {
  const respuesta = await api.put("/account/password", { currentPassword, newPassword });
  return respuesta.data;
}

export async function eliminarCuenta(password) {
  const respuesta = await api.delete("/account", { data: { password } });
  return respuesta.data;
}

// Misma politica que el backend.
export function contrasenaValida(password) {
  return password.length >= 6 && /\d/.test(password);
}
export const MENSAJE_CONTRASENA = "La contraseña debe tener mínimo 6 caracteres y contener al menos un número";
