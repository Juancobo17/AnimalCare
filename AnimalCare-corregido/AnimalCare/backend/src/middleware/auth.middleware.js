// Middleware de autenticacion.
// Protege las rutas privadas: sin un JWT valido, la peticion no continua.
//
// IMPORTANTE: el id del usuario se obtiene SIEMPRE del token, nunca del body
// ni de la URL. Asi el cliente no puede hacerse pasar por otro usuario.
const jwt = require("jsonwebtoken");

const prisma = require("../prisma");

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    // Se espera el formato: Authorization: Bearer <token>
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No autorizado. Debes iniciar sesion." });
    }

    const token = authHeader.substring(7).trim();
    if (token === "") {
      return res.status(401).json({ message: "No autorizado. Debes iniciar sesion." });
    }

    // Verifica la firma y la expiracion del token.
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      // Token invalido, manipulado o expirado.
      return res.status(401).json({ message: "Sesion invalida o expirada. Inicia sesion nuevamente." });
    }

    // El usuario podria haber sido eliminado despues de emitirse el token.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        // El perfil profesional solo existe si la cuenta es de un veterinario.
        vetProfile: {
          select: {
            id: true,
            license: true,
            specialty: true,
            homeService: true,
            clinicService: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Sesion invalida o expirada. Inicia sesion nuevamente." });
    }

    // Queda disponible para los controladores: req.user.id es el propietario.
    req.user = user;
    return next();
  } catch (error) {
    console.error("Error en el middleware de autenticacion:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

module.exports = { authenticate };
