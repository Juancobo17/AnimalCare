const express = require("express");

const { listVets, getVet, getSlots } = require("../controllers/vet.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

// Para ver veterinarios hay que haber iniciado sesion.
router.use(authenticate);

router.get("/", listVets);
router.get("/:id", getVet);
router.get("/:id/slots", getSlots);

module.exports = router;
