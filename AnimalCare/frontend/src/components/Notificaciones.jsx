// Resumen de avisos sin leer en el panel principal (AN-22, AN-23).
// La lista completa está en /notificaciones.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  listarNotificaciones,
  marcarNotificacionLeida,
  formatearMomento,
} from "../services/notification.service";

const MAXIMO_EN_PANEL = 3;

function Notificaciones() {
  const [notificaciones, setNotificaciones] = useState([]);

  useEffect(() => {
    listarNotificaciones()
      .then((datos) => setNotificaciones(datos.notifications))
      .catch(() => {
        // Los avisos son complementarios: si fallan, el panel sigue funcionando.
      });
  }, []);

  async function marcarLeida(id) {
    try {
      await marcarNotificacionLeida(id);
      setNotificaciones((anteriores) => anteriores.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      // Sin cambios si falla.
    }
  }

  const sinLeer = notificaciones.filter((n) => !n.read);
  if (sinLeer.length === 0) {
    return null;
  }

  return (
    <div className="tarjeta notificaciones" aria-live="polite">
      <div className="encabezado-seccion">
        <h3>Notificaciones ({sinLeer.length})</h3>
        <Link to="/notificaciones" className="enlace-seccion">
          Ver todas
        </Link>
      </div>
      <ul>
        {sinLeer.slice(0, MAXIMO_EN_PANEL).map((n) => (
          <li key={n.id} className="notificacion-nueva">
            <div>
              <p>{n.message}</p>
              <span className="texto-suave">{formatearMomento(n.createdAt)}</span>
            </div>
            <button type="button" className="enlace-accion" onClick={() => marcarLeida(n.id)}>
              Marcar como leída
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Notificaciones;
