// Acceso a datos del panel de administracion (AN-35, AN-37, AN-38).
const prisma = require("../prisma");
const notificationService = require("./notification.service");

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  vetProfile: {
    select: {
      license: true,
      specialty: true,
      phone: true,
      bio: true,
      address: true,
      homeService: true,
      clinicService: true,
      licenseDocPath: true,
    },
  },
};

// AN-38: listado con filtros opcionales de estado, rol y texto (nombre o correo).
// Paginado. Los pendientes salen primero: el enum se ordena en el orden en que
// se declaro (PENDING, ACTIVE, SUSPENDED, REJECTED).
async function findUsers({ status, role, q, page = 1, pageSize = 20 }) {
  const where = {};
  if (status) {
    where.status = status;
  }
  if (role) {
    where.role = role;
  }
  if (q) {
    where.OR = [{ name: { contains: q } }, { email: { contains: q } }];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, users };
}

// Cuantos usuarios hay en cada estado (para los filtros del panel).
async function countByStatus() {
  const grupos = await prisma.user.groupBy({ by: ["status"], _count: { _all: true } });
  const totales = { PENDING: 0, ACTIVE: 0, SUSPENDED: 0, REJECTED: 0 };
  grupos.forEach((grupo) => {
    totales[grupo.status] = grupo._count._all;
  });
  return totales;
}

async function findUserById(id) {
  return prisma.user.findUnique({ where: { id }, select: USER_SELECT });
}

// Cambia el estado solo si sigue en uno de los estados esperados (evita pisar
// un cambio hecho al mismo tiempo desde otra pestana) y deja el aviso al usuario.
// Devuelve el usuario actualizado, o null si el estado ya no era el esperado.
async function changeStatus(id, fromStatuses, toStatus, mensaje) {
  return prisma.$transaction(async (tx) => {
    const resultado = await tx.user.updateMany({
      where: { id, status: { in: fromStatuses } },
      data: { status: toStatus },
    });
    if (resultado.count === 0) {
      return null;
    }
    await notificationService.notify(id, mensaje, tx);
    return tx.user.findUnique({ where: { id }, select: USER_SELECT });
  });
}

function toAdminUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    vetProfile: user.vetProfile
      ? (({ licenseDocPath, ...resto }) => ({ ...resto, hasLicenseDoc: Boolean(licenseDocPath) }))(user.vetProfile)
      : null,
  };
}

module.exports = { findUsers, countByStatus, findUserById, changeStatus, toAdminUser };
