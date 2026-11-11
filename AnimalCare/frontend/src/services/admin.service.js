// Panel del administrador (AN-35, AN-37, AN-38).
import api from "./api";

// GET /api/admin/users?status=&role=&q=
export async function listarUsuarios({ status, role, q, page, pageSize } = {}) {
  const params = {};
  if (page) params.page = page;
  if (pageSize) params.pageSize = pageSize;
  if (status) params.status = status;
  if (role) params.role = role;
  if (q) params.q = q;

  const respuesta = await api.get("/admin/users", { params });
  return respuesta.data; // { total, page, totalPages, counts, users }
}

// Abre la tarjeta profesional del veterinario en otra pestaña.
// Se descarga con el token porque el archivo es privado.
export async function verTarjetaProfesional(id) {
  const ventana = window.open("", "_blank");
  try {
    const respuesta = await api.get(`/admin/users/${id}/license-doc`, { responseType: "blob" });
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

// accion: "approve" | "reject" | "suspend" | "reactivate"
export async function cambiarEstadoUsuario(id, accion) {
  const respuesta = await api.patch(`/admin/users/${id}/${accion}`);
  return respuesta.data;
}

export const ESTADOS_CUENTA = {
  PENDING: "Pendiente",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  REJECTED: "Rechazado",
};

export const ROLES = {
  CLIENT: "Dueño de mascota",
  VETERINARIAN: "Veterinario",
  ADMIN: "Administrador",
};

// Texto de cada accion y de su ventana de confirmacion.
export const ACCIONES = {
  approve: {
    boton: "Aprobar",
    pregunta: "¿Aprobar a este veterinario? Su perfil será público y podrá recibir citas.",
    clase: "boton-primario",
  },
  reject: {
    boton: "Rechazar",
    pregunta: "¿Rechazar esta solicitud? El veterinario no podrá acceder a la plataforma.",
    clase: "boton-peligro",
  },
  suspend: {
    boton: "Suspender",
    pregunta: "¿Estás seguro de suspender esta cuenta? Se cerrará su sesión y dejará de aparecer en las búsquedas.",
    clase: "boton-peligro",
  },
  reactivate: {
    boton: "Reactivar",
    pregunta: "¿Reactivar esta cuenta? Recuperará su visibilidad y sus funciones.",
    clase: "boton-primario",
  },
};

// Acciones que se pueden aplicar segun el rol y el estado del usuario.
export function accionesDisponibles(usuario) {
  if (usuario.role === "ADMIN") return [];
  const acciones = [];
  if (usuario.role === "VETERINARIAN" && usuario.status === "PENDING") acciones.push("approve", "reject");
  if (usuario.role === "VETERINARIAN" && usuario.status === "REJECTED") acciones.push("approve");
  if (usuario.status === "ACTIVE") acciones.push("suspend");
  if (usuario.status === "SUSPENDED") acciones.push("reactivate");
  return acciones;
}
