const express = require("express");

const { createAppointment, listMyAppointments } = require("../controllers/appointment.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);

// Agendar es una accion del cliente: un veterinario no se agenda a si mismo.
router.post("/", requireRole("CLIENT"), createAppointment);

// El listado sirve a los dos roles: el controlador decide que citas devolver.
router.get("/", listMyAppointments);

module.exports = router;
