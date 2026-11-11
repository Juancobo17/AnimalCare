const express = require("express");

const { register, login, me } = require("../controllers/auth.controller");
const { forgotPassword, resetPassword, verifyEmail } = require("../controllers/account.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { loginLimiter, forgotLimiter } = require("../middleware/security.middleware");

const router = express.Router();

// Rutas publicas
router.post("/register", register);
// Maximo 5 intentos fallidos por IP y correo cada 15 minutos.
router.post("/login", loginLimiter, login);

// Recuperacion de contrasena y verificacion de correo.
router.post("/forgot-password", forgotLimiter, forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/verify-email", verifyEmail);

// Ruta privada: requiere JWT valido
router.get("/me", authenticate, me);

module.exports = router;
