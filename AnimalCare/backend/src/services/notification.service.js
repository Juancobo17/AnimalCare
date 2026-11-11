// Avisos dentro de la plataforma (AN-35, AN-37, AN-31; base de AN-22 y AN-23).
const prisma = require("../prisma");

const MAX_LISTED = 50;

// db permite usarlo dentro de una transaccion (prisma.$transaction(async (tx) => ...)).
async function notify(userId, message, db = prisma) {
  return db.notification.create({ data: { userId, message } });
}

// Mismo aviso para varios usuarios (por ejemplo, a los veterinarios de turno).
async function notifyMany(userIds, message, db = prisma) {
  if (userIds.length === 0) {
    return { count: 0 };
  }
  return db.notification.createMany({
    data: userIds.map((userId) => ({ userId, message })),
  });
}

async function findByUser(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: MAX_LISTED,
  });
}

// Devuelve cuantas se marcaron: 0 si la notificacion no es de ese usuario.
async function markAsRead(id, userId) {
  const resultado = await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  return resultado.count;
}

async function markAllAsRead(userId) {
  const resultado = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return resultado.count;
}

async function countUnread(userId) {
  return prisma.notification.count({ where: { userId, read: false } });
}

function toPublicNotification(notification) {
  return {
    id: notification.id,
    message: notification.message,
    read: notification.read,
    createdAt: notification.createdAt,
  };
}

module.exports = {
  notify,
  notifyMany,
  findByUser,
  markAsRead,
  markAllAsRead,
  countUnread,
  toPublicNotification,
};
