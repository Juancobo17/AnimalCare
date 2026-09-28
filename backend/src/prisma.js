// Instancia unica de Prisma Client compartida por toda la aplicacion.
// Crear un PrismaClient por peticion abriria demasiadas conexiones a MySQL.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

module.exports = prisma;
