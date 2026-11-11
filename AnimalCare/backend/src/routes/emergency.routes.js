// Urgencias: /api/emergencies
const express = require("express");

const e = require("../controllers/emergency.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);

// Dueño de mascota
router.get("/availability", requireRole("CLIENT"), e.availability);
router.post("/", requireRole("CLIENT"), e.createEmergency);
router.patch("/:id/cancel", requireRole("CLIENT"), e.cancelEmergency);

// Dueño (las suyas) y veterinario (las que acepto)
router.get("/mine", requireRole("CLIENT", "VETERINARIAN"), e.listMine);

// Veterinario
router.get("/duty", requireRole("VETERINARIAN"), e.getDuty);
router.put("/duty", requireRole("VETERINARIAN"), e.setDuty);
router.get("/open", requireRole("VETERINARIAN"), e.listOpen);
router.patch("/:id/accept", requireRole("VETERINARIAN"), e.acceptEmergency);
router.patch("/:id/complete", requireRole("VETERINARIAN"), e.completeEmergency);
router.patch("/:id/release", requireRole("VETERINARIAN"), e.releaseEmergency);

module.exports = router;
