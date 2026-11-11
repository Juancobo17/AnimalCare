const express = require("express");

const {
  createAppointment,
  listMyAppointments,
  cancelAppointment,
  rescheduleAppointment,
  confirmAppointment,
  completeAppointment,
  reviewAppointment,
} = require("../controllers/appointment.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);

// Agendar es una accion del cliente: un veterinario no se agenda a si mismo.
router.post("/", requireRole("CLIENT"), createAppointment);

// El listado sirve a los dos roles: el controlador decide que citas devolver.
router.get("/", listMyAppointments);

// AN-14 (cliente) y AN-15 (veterinario). El controlador comprueba que la cita sea suya.
router.patch("/:id/cancel", requireRole("CLIENT", "VETERINARIAN"), cancelAppointment);

// AN-16: gestion de la agenda por el veterinario.
router.patch("/:id/reschedule", requireRole("VETERINARIAN"), rescheduleAppointment);
router.patch("/:id/confirm", requireRole("VETERINARIAN"), confirmAppointment);
router.patch("/:id/complete", requireRole("VETERINARIAN"), completeAppointment);

// Resena del cliente despues de una cita atendida.
router.post("/:id/review", requireRole("CLIENT"), reviewAppointment);

module.exports = router;
