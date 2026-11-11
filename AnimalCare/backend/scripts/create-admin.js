// Crea la cuenta de administrador (AN-35, AN-37, AN-38).
//
// El rol ADMIN no se puede elegir en el formulario de registro, por eso
// se crea desde la terminal:
//
//   npm run create-admin -- "Nombre" correo@ejemplo.com Contrasena1
//
// La contrasena sigue la misma politica del registro: minimo 6 caracteres
// y al menos un numero.
require("dotenv").config();

const bcrypt = require("bcrypt");
const prisma = require("../src/prisma");

async function main() {
  const [name, emailArg, password] = process.argv.slice(2);

  if (!name || !emailArg || !password) {
    console.error('Uso: npm run create-admin -- "Nombre" correo@ejemplo.com Contrasena1');
    process.exitCode = 1;
    return;
  }

  const email = emailArg.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("El correo no tiene un formato valido.");
    process.exitCode = 1;
    return;
  }
  if (password.length < 6 || !/\d/.test(password)) {
    console.error("La contrasena debe tener minimo 6 caracteres y contener al menos un numero.");
    process.exitCode = 1;
    return;
  }

  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    console.error(`Ya existe una cuenta con el correo ${email} (rol ${existente.role}).`);
    process.exitCode = 1;
    return;
  }

  const admin = await prisma.user.create({
    data: {
      name: name.trim(),
      email,
      password: await bcrypt.hash(password, 10),
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`Administrador creado: ${admin.name} <${admin.email}> (id ${admin.id}).`);
}

main()
  .catch((error) => {
    console.error("No se pudo crear el administrador:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
