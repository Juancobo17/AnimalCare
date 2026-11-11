const express = require("express");
const cors = require("cors");

const { PHOTOS_DIR } = require("./utils/uploads");
const { securityHeaders } = require("./middleware/security.middleware");

const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const vetRoutes = require("./routes/vet.routes");
const appointmentRoutes = require("./routes/appointment.routes");
const notificationRoutes = require("./routes/notification.routes");
const adminRoutes = require("./routes/admin.routes");
const petRoutes = require("./routes/pet.routes");
const medicalRecordRoutes = require("./routes/medicalRecord.routes");
const accountRoutes = require("./routes/account.routes");
const emergencyRoutes = require("./routes/emergency.routes");

const app = express();

// Si corre detras de un proxy (nginx, Docker), la IP real viene en X-Forwarded-For.
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);

app.use(securityHeaders);

// Solo los origenes autorizados pueden consumir la API desde el navegador.
// CORS_ORIGIN admite varios separados por coma. En desarrollo, el frontend de Vite.
const ORIGENES = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      // Sin cabecera Origin (curl, Postman, mismo origen): se permite.
      if (!origin || ORIGENES.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  })
);

// La foto y la tarjeta profesional llegan en base64: esas dos rutas aceptan
// cuerpos mas grandes. Van antes del lector general, que ya no los vuelve a leer.
app.use(["/api/vets/me/photo", "/api/vets/me/license-doc"], express.json({ limit: "8mb" }));
app.use(/^\/api\/medical-records\/\d+\/attachments$/, express.json({ limit: "8mb" }));

// Permite leer cuerpos JSON en las peticiones.
app.use(express.json());

// Fotos publicas de los veterinarios. Las tarjetas profesionales NO se sirven aqui.
app.use("/uploads/photos", express.static(PHOTOS_DIR, { maxAge: "7d", fallthrough: false }));

// Rutas de la API
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/vets", vetRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/pets", petRoutes);
app.use("/api/medical-records", medicalRecordRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/emergencies", emergencyRoutes);

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({ message: "La ruta solicitada no existe." });
});

// Manejador de errores general.
// Registra el detalle en consola y devuelve un mensaje generico al cliente.
app.use((error, req, res, next) => {
  // Cuerpo demasiado grande o JSON mal formado: es un error del cliente.
  if (error && error.type === "entity.too.large") {
    return res.status(413).json({ message: "El archivo es demasiado grande." });
  }
  if (error && error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "El cuerpo de la petición no es un JSON válido." });
  }
  if (error && error.status === 404 && req.path.startsWith("/uploads/")) {
    return res.status(404).json({ message: "El archivo no existe." });
  }
  console.error("Error no controlado:", error);
  res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
});

module.exports = app;
