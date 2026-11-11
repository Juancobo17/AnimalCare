// Borra los usuarios de prueba cuyo correo empieza por un prefijo, con todo lo
// que crearon (mascotas, citas, servicios, horarios, bloqueos, resenas,
// historias clinicas, notificaciones, tokens y archivos subidos).
//
//   node scripts/clean-test-data.js e2e.
//   node scripts/clean-test-data.js qa.
//
// Solo acepta prefijos de prueba conocidos para no borrar cuentas reales.
require("dotenv").config();

const prisma = require("../src/prisma");
const uploads = require("../src/utils/uploads");

const PREFIJOS_PERMITIDOS = ["qa.", "e2e."];

async function main() {
  const prefijo = process.argv[2];
  if (!PREFIJOS_PERMITIDOS.includes(prefijo)) {
    throw new Error(`Prefijo no permitido. Usa uno de: ${PREFIJOS_PERMITIDOS.join(", ")}`);
  }

  const usuarios = await prisma.user.findMany({
    where: { email: { startsWith: prefijo } },
    include: { vetProfile: true },
  });
  const userIds = usuarios.map((u) => u.id);
  const vetIds = usuarios.filter((u) => u.vetProfile).map((u) => u.vetProfile.id);

  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.authToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.medicalRecord.deleteMany({
    where: { OR: [{ pet: { userId: { in: userIds } } }, { vetProfileId: { in: vetIds } }] },
  });
  await prisma.review.deleteMany({
    where: { OR: [{ clientId: { in: userIds } }, { vetProfileId: { in: vetIds } }] },
  });
  await prisma.appointment.deleteMany({
    where: { OR: [{ clientId: { in: userIds } }, { vetProfileId: { in: vetIds } }] },
  });
  await prisma.pet.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.scheduleBlock.deleteMany({ where: { vetProfileId: { in: vetIds } } });
  await prisma.availability.deleteMany({ where: { vetProfileId: { in: vetIds } } });
  await prisma.service.deleteMany({ where: { vetProfileId: { in: vetIds } } });
  for (const u of usuarios.filter((x) => x.vetProfile)) {
    await uploads.deletePhoto(u.vetProfile.photoUrl);
    await uploads.deleteDoc(u.vetProfile.licenseDocPath);
  }
  await prisma.vetProfile.deleteMany({ where: { id: { in: vetIds } } });
  const borrados = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log(`Datos de prueba "${prefijo}*" borrados: ${borrados.count} usuario(s).`);
}

main()
  .catch((error) => {
    console.error("Error:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
