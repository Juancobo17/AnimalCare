// Corrige los datos guardados ANTES de la zona horaria de la clinica.
//
// Hasta esa version, "15:00" se guardaba como 15:00 UTC. Desde entonces,
// "15:00" significa 15:00 en America/Bogota (= 20:00 UTC). Para que las citas,
// bloqueos, fechas de nacimiento y de consulta existentes sigan mostrando la
// misma hora de pared, hay que desplazarlas una sola vez.
//
//   node scripts/fix-timezone-data.js            (muestra que cambiaria)
//   node scripts/fix-timezone-data.js --aplicar  (aplica los cambios)
//
// Se ejecuta UNA sola vez por base de datos: deja una marca (una notificacion
// leida del primer administrador) y se niega a correr de nuevo si la encuentra.
require("dotenv").config();

const prisma = require("../src/prisma");
const { CLINIC_TIMEZONE, toTimeOfDay, combine } = require("../src/utils/schedule");

const APLICAR = process.argv.includes("--aplicar");
const MARCA = "timezone-fix-aplicado";

// Desplaza un instante guardado "como UTC" al instante real en la zona de la clinica.
function desplazar(fecha) {
  // Hora de pared que se quiso guardar:
  const y = fecha.getUTCFullYear();
  const m = fecha.getUTCMonth() + 1;
  const d = fecha.getUTCDate();
  const hh = fecha.getUTCHours();
  const mm = fecha.getUTCMinutes();
  const texto = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const hora = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  return combine(texto, hora);
}

async function main() {
  const marca = await prisma.notification.findFirst({ where: { message: MARCA } });
  if (marca) {
    console.log("Esta base ya fue corregida. No se hace nada.");
    return;
  }

  const [citas, bloqueos, mascotas, entradas] = await Promise.all([
    prisma.appointment.findMany({ select: { id: true, scheduledAt: true } }),
    prisma.scheduleBlock.findMany({ select: { id: true, startsAt: true, endsAt: true } }),
    prisma.pet.findMany({ select: { id: true, birthDate: true } }),
    prisma.medicalRecord.findMany({ select: { id: true, visitDate: true } }),
  ]);

  console.log(`Zona: ${CLINIC_TIMEZONE}`);
  console.log(`Citas: ${citas.length} | Bloqueos: ${bloqueos.length} | Mascotas: ${mascotas.length} | Entradas clinicas: ${entradas.length}`);
  if (citas[0]) {
    const antes = citas[0].scheduledAt;
    console.log(`Ejemplo cita ${citas[0].id}: ${antes.toISOString()} -> ${desplazar(antes).toISOString()} (se vera a las ${toTimeOfDay(desplazar(antes))})`);
  }

  if (!APLICAR) {
    console.log("Modo de prueba. Ejecuta con --aplicar para guardar los cambios.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const c of citas) {
      await tx.appointment.update({ where: { id: c.id }, data: { scheduledAt: desplazar(c.scheduledAt) } });
    }
    for (const b of bloqueos) {
      await tx.scheduleBlock.update({
        where: { id: b.id },
        data: { startsAt: desplazar(b.startsAt), endsAt: desplazar(b.endsAt) },
      });
    }
    for (const p of mascotas) {
      await tx.pet.update({ where: { id: p.id }, data: { birthDate: desplazar(p.birthDate) } });
    }
    for (const e of entradas) {
      await tx.medicalRecord.update({ where: { id: e.id }, data: { visitDate: desplazar(e.visitDate) } });
    }
    const admin = await tx.user.findFirst({ where: { role: "ADMIN" }, orderBy: { id: "asc" } });
    if (admin) {
      await tx.notification.create({ data: { userId: admin.id, message: MARCA, read: true } });
    }
  });
  console.log("Listo. Los datos quedaron en la zona horaria de la clinica.");
}

main()
  .catch((error) => {
    console.error("Error:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
