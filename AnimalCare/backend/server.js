require("dotenv").config();

const app = require("./src/app");
const { startReminderJob } = require("./src/services/reminder.service");

// Sin la clave secreta no es posible firmar ni verificar tokens.
// Es preferible fallar al arrancar que devolver errores confusos despues.
if (!process.env.JWT_SECRET) {
  console.error("Falta la variable JWT_SECRET en el archivo .env");
  process.exit(1);
}

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`AnimalCare API escuchando en http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);

  // Recordatorios de citas de las proximas 24 horas (cada 10 minutos).
  startReminderJob();
});
