const express = require("express");
const cors = require("cors");

const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const vetRoutes = require("./routes/vet.routes");
const appointmentRoutes = require("./routes/appointment.routes");

const app = express();

// Permite que el frontend (Vite, otro puerto) consuma la API.
app.use(cors());

// Permite leer cuerpos JSON en las peticiones.
app.use(express.json());

// Rutas de la API
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/vets", vetRoutes);
app.use("/api/appointments", appointmentRoutes);

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({ message: "La ruta solicitada no existe." });
});

// Manejador de errores general.
// Registra el detalle en consola y devuelve un mensaje generico al cliente.
app.use((error, req, res, next) => {
  console.error("Error no controlado:", error);
  res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
});

module.exports = app;
