// Rutas del panel del veterinario: /api/vets/me/...
// Solo para cuentas VETERINARIAN. Un veterinario PENDING tambien entra:
// puede ir cargando sus servicios y su horario mientras lo aprueban (AN-28 criterio 2).
const express = require("express");

const panel = require("../controllers/vetPanel.controller");

const router = express.Router();

// Perfil editable, foto y tarjeta profesional
router.get("/profile", panel.getMyProfile);
router.put("/profile", panel.updateMyProfile);
router.put("/photo", panel.uploadMyPhoto);
router.delete("/photo", panel.deleteMyPhoto);
router.put("/license-doc", panel.uploadMyLicenseDoc);

// AN-28, AN-29, AN-30
router.get("/services", panel.listMyServices);
router.post("/services", panel.addService);
router.put("/services/:serviceId", panel.updateService);
router.delete("/services/:serviceId", panel.removeService);

// AN-31
router.get("/availability", panel.getMyAvailability);
router.put("/availability", panel.updateMyAvailability);
router.get("/blocks", panel.listMyBlocks);
router.post("/blocks", panel.addBlock);
router.delete("/blocks/:blockId", panel.removeBlock);

module.exports = router;
