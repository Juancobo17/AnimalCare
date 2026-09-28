// Cliente HTTP compartido por toda la aplicacion.
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
});

// Antes de cada peticion, adjunta el token guardado (si existe).
// Asi las rutas privadas del backend reciben: Authorization: Bearer <token>
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

// Convierte la respuesta de error del backend en una lista de mensajes
// para mostrarlos al usuario. El backend responde { message, errors? }.
export function obtenerMensajesDeError(error) {
  const datos = error.response?.data;

  if (datos?.errors?.length) {
    return datos.errors;
  }
  if (datos?.message) {
    return [datos.message];
  }
  // Sin respuesta del servidor: normalmente el backend esta apagado.
  return ["No fue posible conectar con el servidor. Verifica que la API este encendida."];
}
