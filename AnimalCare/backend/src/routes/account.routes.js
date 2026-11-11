// Cuenta del usuario que inicio sesion: /api/account
const express = require("express");

const account = require("../controllers/account.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authenticate);

router.put("/", account.updateAccount);
router.put("/password", account.changePassword);
router.delete("/", account.deleteAccount);
router.post("/resend-verification", account.resendVerification);

module.exports = router;
