// Logica de autenticacion: hash de contrasenas, verificacion y generacion de JWT.
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const prisma = require("../prisma");

// Numero de rondas de bcrypt. A mayor numero, mas lento y mas seguro.
// 10 es el valor recomendado habitual.
const SALT_ROUNDS = 10;

// Horario que se carga automaticamente al registrar un veterinario:
// de lunes a viernes, manana y tarde. Asi el profesional queda disponible
// desde el primer momento y el cliente puede agendar (AN-13).
const DEFAULT_AVAILABILITY = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, startTime: "09:00", endTime: "13:00" },
  { weekday, startTime: "14:00", endTime: "18:00" },
]);

// Busca un usuario por su correo. Devuelve null si no existe.
// Incluye el perfil profesional cuando la cuenta es de un veterinario.
async function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
    include: { vetProfile: true },
  });
}

// Comprueba si una matricula profesional ya esta registrada.
async function findVetProfileByLicense(license) {
  return prisma.vetProfile.findUnique({ where: { license } });
}

// Crea un usuario guardando SIEMPRE la contrasena hasheada, nunca en texto plano.
//
// Si el rol es VETERINARIAN se crea ademas su perfil profesional, sus servicios
// y su horario por defecto. Todo ocurre dentro de una transaccion: o se guarda
// el conjunto completo, o no se guarda nada. Nunca queda un veterinario a medias.
async function createUser({ name, email, password, role = "CLIENT", profile = null }) {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  if (role !== "VETERINARIAN") {
    return prisma.user.create({
      data: { name, email, password: hashedPassword, role: "CLIENT" },
    });
  }

  return prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: "VETERINARIAN",
      vetProfile: {
        create: {
          license: profile.license,
          specialty: profile.specialty,
          bio: profile.bio,
          phone: profile.phone,
          address: profile.address,
          homeService: profile.homeService,
          clinicService: profile.clinicService,
          services: {
            create: profile.services,
          },
          availabilities: {
            create: DEFAULT_AVAILABILITY,
          },
        },
      },
    },
    include: { vetProfile: true },
  });
}

// Compara la contrasena escrita por el usuario contra el hash almacenado.
// bcrypt no "desencripta": vuelve a hashear y compara.
async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

// Genera el JWT. El payload solo lleva el id del usuario:
// es el dato que el backend usara para saber de quien son las mascotas y las citas.
function generateToken(user) {
  return jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "2h" }
  );
}

// Devuelve los datos del usuario que SI pueden enviarse al frontend.
// La contrasena (hash incluido) nunca sale de la API.
function toPublicUser(user) {
  const publicUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };

  // El frontend usa estos datos para decidir que panel mostrar.
  if (user.vetProfile) {
    publicUser.vetProfile = {
      id: user.vetProfile.id,
      license: user.vetProfile.license,
      specialty: user.vetProfile.specialty,
      homeService: user.vetProfile.homeService,
      clinicService: user.vetProfile.clinicService,
    };
  }

  return publicUser;
}

module.exports = {
  findUserByEmail,
  findVetProfileByLicense,
  createUser,
  verifyPassword,
  generateToken,
  toPublicUser,
  DEFAULT_AVAILABILITY,
};
