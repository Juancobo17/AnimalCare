// Mascotas del dueño: /api/pets
const express = require("express");

const pets = require("../controllers/pet.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate, requireRole("CLIENT"));

router.get("/", pets.listMyPets);
router.post("/", pets.createPet);
router.put("/:id", pets.updatePet);
router.delete("/:id", pets.deactivatePet);

module.exports = router;
