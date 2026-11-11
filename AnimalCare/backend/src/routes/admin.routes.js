// Rutas del administrador: /api/admin/...
const express = require("express");

const admin = require("../controllers/admin.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();

router.use(authenticate, requireRole("ADMIN"));

router.get("/users", admin.listUsers); // AN-38
router.get("/users/:id/license-doc", admin.downloadLicenseDoc); // AN-35
router.patch("/users/:id/approve", admin.approveUser); // AN-35
router.patch("/users/:id/reject", admin.rejectUser); // AN-35
router.patch("/users/:id/suspend", admin.suspendUser); // AN-37
router.patch("/users/:id/reactivate", admin.reactivateUser); // AN-37

module.exports = router;
