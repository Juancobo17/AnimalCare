const prisma = require("../prisma");

// GET /api/health
// Comprueba que la API responde y que Prisma puede comunicarse con MySQL.
async function getHealth(req, res) {
  try {
    // Consulta minima para verificar la conexion con la base de datos.
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      status: "ok",
      api: "AnimalCare API",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // No exponemos el error interno al cliente, solo lo registramos en consola.
    console.error("Error en /api/health:", error.message);

    return res.status(500).json({
      status: "error",
      api: "AnimalCare API",
      database: "disconnected",
      message: "No fue posible conectar con la base de datos.",
    });
  }
}

module.exports = { getHealth };
