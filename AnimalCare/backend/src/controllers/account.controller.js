// Cuenta del usuario: recuperar contrasena, verificar correo, editar datos,
// cambiar contrasena y eliminar la cuenta (Ley 1581 de proteccion de datos).
const crypto = require("node:crypto");
const bcrypt = require("bcrypt");

const prisma = require("../prisma");
const authService = require("../services/auth.service");
const mail = require("../services/mail.service");
const { isBlocked } = require("../utils/accountStatus");

const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
const RESET_TTL_MIN = 60;
const VERIFY_TTL_HOURS = 48;
const MIN_PASSWORD_LENGTH = 6;
const MENSAJE_CONTRASENA = "La contraseña debe tener mínimo 6 caracteres y contener al menos un número";
const MAX_NAME_LENGTH = 60;

function serverError(res, where, error) {
  console.error(`Error en ${where}:`, error);
  return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
}

function badRequest(res, errors) {
  return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
}

function contrasenaValida(password) {
  const texto = String(password ?? "");
  return texto.length >= MIN_PASSWORD_LENGTH && /\d/.test(texto);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Crea un token de un solo uso, invalida los anteriores del mismo tipo y
// devuelve el token en claro (solo viaja por correo).
async function emitirToken(userId, purpose, ttlMs) {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.authToken.create({
      data: { userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
    }),
  ]);
  return token;
}

// Devuelve el registro del token si es valido y vigente; null si no.
async function tokenVigente(token, purpose) {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
  const registro = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!registro || registro.purpose !== purpose || registro.usedAt || registro.expiresAt < new Date()) {
    return null;
  }
  return registro;
}

async function enviarVerificacion(user) {
  const token = await emitirToken(user.id, "EMAIL_VERIFICATION", VERIFY_TTL_HOURS * 60 * 60 * 1000);
  const enlace = `${FRONTEND_URL}/verificar-correo?token=${token}`;
  const { text, html } = mail.plantilla({
    titulo: `Hola, ${user.name.split(" ")[0]}. Confirma tu correo`,
    cuerpo: "Gracias por registrarte en AnimalCare. Confirma tu correo para asegurar tu cuenta y poder recuperar tu contraseña si la olvidas.",
    enlace,
    textoBoton: "Confirmar correo",
  });
  await mail.sendMail({ to: user.email, subject: "Confirma tu correo en AnimalCare", text, html });
}

// ---------- Recuperar contrasena ----------

// POST /api/auth/forgot-password  { email }
// Responde siempre igual para no revelar que correos existen.
async function forgotPassword(req, res) {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (email === "") return badRequest(res, ["El correo es obligatorio."]);

    const user = await authService.findUserByEmail(email);
    if (user && !isBlocked(user.status) && user.status !== "DELETED") {
      const token = await emitirToken(user.id, "PASSWORD_RESET", RESET_TTL_MIN * 60 * 1000);
      const enlace = `${FRONTEND_URL}/restablecer?token=${token}`;
      const { text, html } = mail.plantilla({
        titulo: "Restablece tu contraseña",
        cuerpo: `Recibimos una solicitud para cambiar la contraseña de tu cuenta. El enlace vence en ${RESET_TTL_MIN} minutos.`,
        enlace,
        textoBoton: "Crear nueva contraseña",
      });
      await mail.sendMail({ to: user.email, subject: "Restablece tu contraseña de AnimalCare", text, html });
    }

    return res.status(200).json({
      message: "Si el correo está registrado, te enviamos un enlace para restablecer la contraseña. Revisa tu bandeja de entrada y el correo no deseado.",
    });
  } catch (error) {
    return serverError(res, "forgotPassword", error);
  }
}

// POST /api/auth/reset-password  { token, password }
async function resetPassword(req, res) {
  try {
    const { token, password } = req.body || {};
    if (!contrasenaValida(password)) return badRequest(res, [MENSAJE_CONTRASENA]);

    const registro = await tokenVigente(token, "PASSWORD_RESET");
    if (!registro) {
      return res.status(400).json({ message: "El enlace no es válido o ya venció. Solicita uno nuevo." });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: registro.userId },
        data: { password: await bcrypt.hash(String(password), 10) },
      }),
      prisma.authToken.update({ where: { id: registro.id }, data: { usedAt: new Date() } }),
    ]);
    return res.status(200).json({ message: "Contraseña actualizada. Ya puedes iniciar sesión." });
  } catch (error) {
    return serverError(res, "resetPassword", error);
  }
}

// ---------- Verificar correo ----------

// POST /api/auth/verify-email  { token }
async function verifyEmail(req, res) {
  try {
    const registro = await tokenVigente(req.body?.token, "EMAIL_VERIFICATION");
    if (!registro) {
      return res.status(400).json({ message: "El enlace no es válido o ya venció. Pide uno nuevo desde tu cuenta." });
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: registro.userId }, data: { emailVerifiedAt: new Date() } }),
      prisma.authToken.update({ where: { id: registro.id }, data: { usedAt: new Date() } }),
    ]);
    return res.status(200).json({ message: "Correo confirmado. ¡Gracias!" });
  } catch (error) {
    return serverError(res, "verifyEmail", error);
  }
}

// POST /api/account/resend-verification  (sesion iniciada)
async function resendVerification(req, res) {
  try {
    if (req.user.emailVerifiedAt) {
      return res.status(409).json({ message: "Tu correo ya está confirmado." });
    }
    await enviarVerificacion(req.user);
    return res.status(200).json({ message: `Te enviamos un nuevo enlace a ${req.user.email}.` });
  } catch (error) {
    return serverError(res, "resendVerification", error);
  }
}

// ---------- Mi cuenta ----------

// PUT /api/account  { name }
async function updateAccount(req, res) {
  try {
    const name = String(req.body?.name ?? "").trim();
    const errors = [];
    if (name === "") errors.push("El nombre es obligatorio.");
    else if (name.length > MAX_NAME_LENGTH) errors.push(`El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres.`);
    if (errors.length > 0) return badRequest(res, errors);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name },
      include: { vetProfile: true },
    });
    return res.status(200).json({ message: "Datos actualizados.", user: authService.toPublicUser(user) });
  } catch (error) {
    return serverError(res, "updateAccount", error);
  }
}

// PUT /api/account/password  { currentPassword, newPassword }
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const errors = [];
    if (!currentPassword) errors.push("Escribe tu contraseña actual.");
    if (!contrasenaValida(newPassword)) errors.push(MENSAJE_CONTRASENA);
    if (errors.length > 0) return badRequest(res, errors);

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!(await bcrypt.compare(String(currentPassword), user.password))) {
      return res.status(400).json({ message: "La contraseña actual no es correcta." });
    }
    if (await bcrypt.compare(String(newPassword), user.password)) {
      return badRequest(res, ["La nueva contraseña debe ser distinta de la actual."]);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(String(newPassword), 10) },
    });
    return res.status(200).json({ message: "Contraseña cambiada correctamente." });
  } catch (error) {
    return serverError(res, "changePassword", error);
  }
}

// DELETE /api/account  { password }
// Derecho de supresion: se anonimizan los datos personales. Las citas, resenas
// e historias clinicas se conservan (son registros medicos y de la agenda del
// veterinario), pero ya no identifican a la persona.
async function deleteAccount(req, res) {
  try {
    if (req.user.role === "ADMIN") {
      return res.status(403).json({ message: "Una cuenta de administrador no se elimina desde aquí." });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { vetProfile: true } });
    if (!(await bcrypt.compare(String(req.body?.password ?? ""), user.password))) {
      return res.status(400).json({ message: "La contraseña no es correcta." });
    }

    const ahora = new Date();
    await prisma.$transaction(async (tx) => {
      // Citas futuras: se cancelan y se avisa a la otra parte.
      const futuras = await tx.appointment.findMany({
        where: {
          OR: [{ clientId: user.id }, ...(user.vetProfile ? [{ vetProfileId: user.vetProfile.id }] : [])],
          status: { in: ["PENDING", "CONFIRMED"] },
          scheduledAt: { gt: ahora },
        },
        include: { vetProfile: { select: { userId: true } } },
      });
      for (const cita of futuras) {
        await tx.appointment.update({ where: { id: cita.id }, data: { status: "CANCELLED" } });
        const otro = cita.clientId === user.id ? cita.vetProfile.userId : cita.clientId;
        await tx.notification.create({
          data: { userId: otro, message: "Una de tus citas fue cancelada porque la otra persona eliminó su cuenta." },
        });
      }
      // Urgencias: las del dueño se cancelan; las que atendia el veterinario se reabren.
      await tx.emergencyRequest.updateMany({
        where: { clientId: user.id, status: { in: ["OPEN", "ACCEPTED"] } },
        data: { status: "CANCELLED", closedAt: ahora },
      });
      if (user.vetProfile) {
        await tx.emergencyRequest.updateMany({
          where: { vetProfileId: user.vetProfile.id, status: "ACCEPTED" },
          data: { status: "OPEN", vetProfileId: null, acceptedAt: null },
        });
      }
      await tx.pet.updateMany({ where: { userId: user.id }, data: { status: "INACTIVE" } });
      await tx.notification.deleteMany({ where: { userId: user.id } });
      await tx.authToken.deleteMany({ where: { userId: user.id } });
      if (user.vetProfile) {
        await tx.service.updateMany({ where: { vetProfileId: user.vetProfile.id }, data: { active: false } });
        await tx.vetProfile.update({
          where: { id: user.vetProfile.id },
          data: { bio: null, phone: null, photoUrl: null, licenseDocPath: null, address: null, emergencyUntil: null },
        });
      }
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: "Usuario eliminado",
          email: `eliminado-${user.id}@anonimo.animalcare.local`,
          password: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10),
          status: "DELETED",
          deletedAt: ahora,
        },
      });
    });
    return res.status(200).json({ message: "Tu cuenta fue eliminada. Gracias por usar AnimalCare." });
  } catch (error) {
    return serverError(res, "deleteAccount", error);
  }
}

module.exports = {
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  updateAccount,
  changePassword,
  deleteAccount,
  enviarVerificacion,
};
