// Consultas de veterinarios: listado, perfil detallado (AN-26)
// y horarios disponibles (AN-13).
import api from "./api";

// GET /api/vets?specialty=&mode=
export async function listarVeterinarios({ specialty, mode } = {}) {
  const params = {};
  if (specialty) {
    params.specialty = specialty;
  }
  if (mode) {
    params.mode = mode;
  }

  const respuesta = await api.get("/vets", { params });
  return respuesta.data.vets;
}

// GET /api/vets/:id
export async function obtenerVeterinario(id) {
  const respuesta = await api.get(`/vets/${id}`);
  return respuesta.data.vet;
}

// GET /api/vets/:id/slots?date=&mode=&serviceId=
// Devuelve las horas libres de ese dia, por ejemplo ["09:00", "09:30"].
export async function obtenerHorarios(id, { date, mode, serviceId } = {}) {
  const params = { date };
  if (mode) {
    params.mode = mode;
  }
  if (serviceId) {
    params.serviceId = serviceId;
  }

  const respuesta = await api.get(`/vets/${id}/slots`, { params });
  return respuesta.data;
}

// Etiquetas de las modalidades de atencion (AN-10 y AN-11).
export const MODALIDADES = {
  HOME: "A domicilio",
  CLINIC: "En la veterinaria",
};

// Nombre de los dias de la semana, en el orden que usa la API (0 = domingo).
export const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
