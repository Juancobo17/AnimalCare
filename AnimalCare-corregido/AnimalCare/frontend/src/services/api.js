// Cliente HTTP compartido por toda la aplicacion.
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
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
  // Sin respuesta del servidor: normalmente no hay conexion o el servicio esta caido.
  return [MENSAJE_SIN_CONEXION];
}

export const MENSAJE_SIN_CONEXION =
  "No pudimos conectarnos en este momento. Revisa tu conexión a internet e inténtalo de nuevo.";

// true cuando la peticion no obtuvo respuesta del servidor (servidor caido,
// sin internet, tiempo agotado) o cuando el proxy (nginx) responde 502, 503 o 504
// porque el backend esta apagado. En ese caso tiene sentido "Reintentar".
export function esErrorDeConexion(error) {
  if (!error) {
    return false;
  }
  if (!error.response) {
    return true;
  }
  return [502, 503, 504].includes(error.response.status);
}

// Errores asociados a un campo concreto, por ejemplo { email: "...", license: "..." }.
// El backend los envia en fieldErrors cuando un dato unico ya existe.
export function obtenerErroresDeCampo(error) {
  return error?.response?.data?.fieldErrors || {};
}


