// Notificaciones del usuario que inicio sesion.
const notificationService = require("../services/notification.service");
const { parseId } = require("../utils/params");

// GET /api/notifications
async function listMyNotifications(req, res) {
  try {
    const [notificaciones, sinLeer] = await Promise.all([
      notificationService.findByUser(req.user.id),
      notificationService.countUnread(req.user.id),
    ]);
    return res.status(200).json({
      unread: sinLeer,
      notifications: notificaciones.map(notificationService.toPublicNotification),
    });
  } catch (error) {
    console.error("Error en listMyNotifications:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

// PATCH /api/notifications/:id/read
async function markNotificationAsRead(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "El identificador de la notificacion no es valido." });
    }

    const marcadas = await notificationService.markAsRead(id, req.user.id);
    if (marcadas === 0) {
      return res.status(404).json({ message: "La notificacion no existe." });
    }

    return res.status(200).json({ message: "Notificacion marcada como leida." });
  } catch (error) {
    console.error("Error en markNotificationAsRead:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

// PATCH /api/notifications/read-all
async function markAllNotificationsAsRead(req, res) {
  try {
    const marcadas = await notificationService.markAllAsRead(req.user.id);
    return res.status(200).json({ message: "Todas las notificaciones quedaron leidas.", updated: marcadas });
  } catch (error) {
    console.error("Error en markAllNotificationsAsRead:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

module.exports = { listMyNotifications, markNotificationAsRead, markAllNotificationsAsRead };
