// Reglas del estado de cuenta (AN-35, AN-37).
//
// Un usuario SUSPENDED o REJECTED no puede iniciar sesion ni usar un token
// que ya tenia: el middleware lo rechaza en la siguiente peticion, lo que
// equivale a cerrarle la sesion activa.
const BLOCKED_STATUSES = ["SUSPENDED", "REJECTED", "DELETED"];

const MENSAJES_BLOQUEO = {
  SUSPENDED: "Tu cuenta está suspendida. Comunícate con el administrador de AnimalCare.",
  REJECTED: "Tu solicitud de registro fue rechazada. Comunícate con el administrador de AnimalCare.",
  DELETED: "Esta cuenta fue eliminada.",
};

// Codigo que el frontend usa para saber que debe cerrar la sesion local.
const CODIGO_CUENTA_BLOQUEADA = "ACCOUNT_BLOCKED";

function isBlocked(status) {
  return BLOCKED_STATUSES.includes(status);
}

// Respuesta 403 comun para el login y el middleware.
function blockedResponse(res, status) {
  return res.status(403).json({
    message: MENSAJES_BLOQUEO[status],
    code: CODIGO_CUENTA_BLOQUEADA,
    status,
  });
}

module.exports = { BLOCKED_STATUSES, isBlocked, blockedResponse, CODIGO_CUENTA_BLOQUEADA };
