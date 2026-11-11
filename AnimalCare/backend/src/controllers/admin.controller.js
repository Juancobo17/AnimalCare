// Panel del administrador.
//
// AN-35 verificar cuentas de veterinarios (aprobar / rechazar)
// AN-37 suspender y reactivar cuentas
// AN-38 listado general de usuarios con filtros
const path = require("node:path");

const adminService = require("../services/admin.service");
const { parseId } = require("../utils/params");
const uploads = require("../utils/uploads");

const ESTADOS = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED", "DELETED"];
const ROLES = ["CLIENT", "VETERINARIAN", "ADMIN"];
const MAX_QUERY_LENGTH = 60;
const MAX_PAGE_SIZE = 100;

function serverError(res, where, error) {
  console.error(`Error en ${where}:`, error);
  return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
}

// GET /api/admin/users?status=&role=&q=
async function listUsers(req, res) {
  try {
    const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
    const role = req.query.role ? String(req.query.role).toUpperCase() : undefined;
    const q = req.query.q ? String(req.query.q).trim() : "";
    const errors = [];

    if (status && !ESTADOS.includes(status)) {
      errors.push(`El estado debe ser uno de: ${ESTADOS.join(", ")}.`);
    }
    if (role && !ROLES.includes(role)) {
      errors.push(`El rol debe ser uno de: ${ROLES.join(", ")}.`);
    }
    if (q.length > MAX_QUERY_LENGTH) {
      errors.push(`La busqueda no puede superar los ${MAX_QUERY_LENGTH} caracteres.`);
    }
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const pageSize = req.query.pageSize === undefined ? 20 : Number(req.query.pageSize);
    if (!Number.isInteger(page) || page < 1) {
      errors.push("La página debe ser un número entero mayor a 0.");
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      errors.push(`El tamaño de página debe estar entre 1 y ${MAX_PAGE_SIZE}.`);
    }
    if (errors.length > 0) {
      return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
    }

    const [{ total, users }, totales] = await Promise.all([
      adminService.findUsers({ status, role, q: q || undefined, page, pageSize }),
      adminService.countByStatus(),
    ]);

    return res.status(200).json({
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      counts: totales,
      users: users.map(adminService.toAdminUser),
    });
  } catch (error) {
    return serverError(res, "listUsers", error);
  }
}

// Reglas de cada accion: a quien se aplica, desde que estado y que aviso recibe.
const ACCIONES = {
  approve: {
    soloVeterinarios: true,
    desde: ["PENDING", "REJECTED"],
    hacia: "ACTIVE",
    aviso: "¡Tu cuenta fue aprobada! Tu perfil ya es público y puedes empezar a recibir citas.",
    exito: "Veterinario aprobado. Su perfil ya es público.",
    errorEstado: "Solo se pueden aprobar veterinarios pendientes o rechazados.",
  },
  reject: {
    soloVeterinarios: true,
    desde: ["PENDING"],
    hacia: "REJECTED",
    aviso: "Tu solicitud de registro fue rechazada. Comunícate con el administrador de AnimalCare.",
    exito: "Solicitud rechazada. El veterinario no podrá acceder a la plataforma.",
    errorEstado: "Solo se pueden rechazar veterinarios pendientes de verificación.",
  },
  suspend: {
    soloVeterinarios: false,
    desde: ["ACTIVE"],
    hacia: "SUSPENDED",
    aviso: "Tu cuenta fue suspendida por incumplir las normas de AnimalCare.",
    exito: "Cuenta suspendida. Se cerró su sesión y su perfil ya no aparece en las búsquedas.",
    errorEstado: "Solo se pueden suspender cuentas activas.",
  },
  reactivate: {
    soloVeterinarios: false,
    desde: ["SUSPENDED"],
    hacia: "ACTIVE",
    aviso: "Tu cuenta fue reactivada. Ya puedes volver a usar AnimalCare.",
    exito: "Cuenta reactivada. Recuperó su visibilidad y sus funciones.",
    errorEstado: "Solo se pueden reactivar cuentas suspendidas.",
  },
};

function crearAccion(nombre) {
  const regla = ACCIONES[nombre];

  return async function accion(req, res) {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "El identificador del usuario no es valido." });
      }

      const usuario = await adminService.findUserById(id);
      if (!usuario) {
        return res.status(404).json({ message: "El usuario no existe." });
      }

      if (usuario.status === "DELETED") {
        return res.status(409).json({ message: "La cuenta fue eliminada por su titular y no se puede modificar." });
      }
      // Un administrador no se gestiona desde aqui (ni a si mismo ni a otro).
      if (usuario.role === "ADMIN") {
        return res.status(403).json({ message: "No se puede cambiar el estado de un administrador." });
      }
      if (regla.soloVeterinarios && usuario.role !== "VETERINARIAN") {
        return res.status(400).json({ message: "Esta acción solo aplica a cuentas de veterinario." });
      }
      if (!regla.desde.includes(usuario.status)) {
        return res.status(409).json({ message: regla.errorEstado });
      }

      const actualizado = await adminService.changeStatus(id, regla.desde, regla.hacia, regla.aviso);
      if (!actualizado) {
        return res.status(409).json({ message: "El usuario cambió de estado. Actualiza la página." });
      }

      return res.status(200).json({ message: regla.exito, user: adminService.toAdminUser(actualizado) });
    } catch (error) {
      return serverError(res, `admin ${nombre}`, error);
    }
  };
}

// GET /api/admin/users/:id/license-doc
// Descarga la tarjeta profesional de un veterinario para revisarla (AN-35).
async function downloadLicenseDoc(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "El identificador del usuario no es valido." });
    }
    const usuario = await adminService.findUserById(id);
    const nombre = usuario?.vetProfile?.licenseDocPath;
    if (!nombre) {
      return res.status(404).json({ message: "Este veterinario no ha cargado su tarjeta profesional." });
    }
    const tipos = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".png": "image/png" };
    res.type(tipos[path.extname(nombre)] || "application/octet-stream");
    return res.sendFile(uploads.docAbsolutePath(nombre), (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ message: "El archivo ya no está disponible." });
      }
    });
  } catch (error) {
    return serverError(res, "downloadLicenseDoc", error);
  }
}

module.exports = {
  downloadLicenseDoc,
  listUsers,
  approveUser: crearAccion("approve"),
  rejectUser: crearAccion("reject"),
  suspendUser: crearAccion("suspend"),
  reactivateUser: crearAccion("reactivate"),
};
