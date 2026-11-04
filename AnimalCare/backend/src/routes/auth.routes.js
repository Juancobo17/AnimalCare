const express = require("express");

const { register, login, me } = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

// Rutas publicas
router.post("/register", register);
router.post("/login", login);

// Ruta privada: requiere JWT valido
router.get("/me", authenticate, me);

module.exports = router;
