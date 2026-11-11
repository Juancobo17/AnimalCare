// Historias clinicas: /api/medical-records  (AN-18, AN-19, AN-20, AN-21)
const express = require("express");

const records = require("../controllers/medicalRecord.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate);

// Dueño (AN-21) y veterinario con cita con la mascota.
router.get("/pets/:petId", requireRole("CLIENT", "VETERINARIAN"), records.getPetHistory);

// Solo el veterinario escribe en la historia.
router.post("/", requireRole("VETERINARIAN"), records.createRecord); // AN-18
router.put("/:id", requireRole("VETERINARIAN"), records.updateRecord); // AN-20
router.patch("/:id/annul", requireRole("VETERINARIAN"), records.annulRecord); // AN-19

module.exports = router;
