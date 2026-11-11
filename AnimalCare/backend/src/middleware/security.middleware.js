// Medidas basicas de seguridad HTTP.

// Cabeceras que evitan abusos comunes (sniffing de tipos, iframes ajenos,
// filtrado del referer). Equivalente reducido de helmet, sin dependencia.
function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
}

// Limite de intentos para el inicio de sesion y la recuperacion de contrasena.
// Cuenta los fallos por IP + correo en memoria; tras `max` fallos en `windowMs`
// bloquea ese par durante `windowMs`. Sirve para una sola instancia del servidor.
function createRateLimit({ max = 5, windowMs = 15 * 60 * 1000, keyFrom } = {}) {
  const intentos = new Map();

  function limpiar(ahora) {
    for (const [clave, dato] of intentos) {
      if (dato.hasta <= ahora) intentos.delete(clave);
    }
  }

  function middleware(req, res, next) {
    const ahora = Date.now();
    if (intentos.size > 1000) limpiar(ahora);
    const clave = keyFrom(req);
    const dato = intentos.get(clave);
    if (dato && dato.fallos >= max && dato.hasta > ahora) {
      const minutos = Math.ceil((dato.hasta - ahora) / 60000);
      res.setHeader("Retry-After", String(Math.ceil((dato.hasta - ahora) / 1000)));
      return res.status(429).json({
        message: `Demasiados intentos. Inténtalo de nuevo en ${minutos} minuto(s).`,
      });
    }
    // El controlador llama a req.rateLimit.fail() si el intento fracasa
    // y a req.rateLimit.reset() si tiene exito.
    req.rateLimit = {
      fail() {
        const actual = intentos.get(clave);
        if (!actual || actual.hasta <= ahora) {
          intentos.set(clave, { fallos: 1, hasta: ahora + windowMs });
        } else {
          actual.fallos += 1;
          actual.hasta = ahora + windowMs;
        }
      },
      reset() {
        intentos.delete(clave);
      },
    };
    return next();
  }

  middleware.clear = () => intentos.clear();
  return middleware;
}

function ipDe(req) {
  return req.ip || req.socket?.remoteAddress || "desconocida";
}

const loginLimiter = createRateLimit({
  max: Number(process.env.LOGIN_MAX_ATTEMPTS) || 5,
  windowMs: (Number(process.env.LOGIN_LOCK_MINUTES) || 15) * 60 * 1000,
  keyFrom: (req) => `${ipDe(req)}|${String(req.body?.email ?? "").trim().toLowerCase()}`,
});

// Recuperacion de contrasena: cada peticion cuenta (no hay "fallo"), 5 por IP y hora.
const forgotLimiter = createRateLimit({
  max: 5,
  windowMs: 60 * 60 * 1000,
  keyFrom: (req) => `forgot|${ipDe(req)}`,
});

module.exports = { securityHeaders, createRateLimit, loginLimiter, forgotLimiter };
