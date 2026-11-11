const express = require("express");

const { listVets, getVet, getSlots, getDays } = require("../controllers/vet.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const vetPanelRoutes = require("./vetPanel.routes");

const router = express.Router();

// Para ver veterinarios hay que haber iniciado sesion.
router.use(authenticate);

// Va antes de "/:id" para que "me" no se lea como un id.
router.use("/me", requireRole("VETERINARIAN"), vetPanelRoutes);

router.get("/", listVets);
router.get("/:id", getVet);
router.get("/:id/slots", getSlots);
router.get("/:id/days", getDays);

module.exports = router;
