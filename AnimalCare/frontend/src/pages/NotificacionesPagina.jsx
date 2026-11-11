// AN-22 (dueño de mascota) y AN-23 (veterinario): todas las notificaciones
// que el sistema envia sobre citas, cancelaciones y el estado de la cuenta.
import { useEffect, useState } from "react";

import { usarTitulo } from "../hooks/usarTitulo";
import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import Icono from "../components/Icono";
import {
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  formatearMomento,
} from "../services/notification.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

function NotificacionesPagina() {
  usarTitulo("Notificaciones");
  const [notificaciones, setNotificaciones] = useState([]);
  const [soloSinLeer, setSoloSinLeer] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errores, setErrores] = useState([]);
  const [sinConexion, setSinConexion] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    setCargando(true);
    setErrores([]);
    listarNotificaciones()
      .then((datos) => setNotificaciones(datos.notifications))
      .catch((error) => {
        setErrores(obtenerMensajesDeError(error));
        setSinConexion(esErrorDeConexion(error));
      })
      .finally(() => setCargando(false));
  }, [intento]);

  async function marcarLeida(id) {
    try {
      await marcarNotificacionLeida(id);
      setNotificaciones((anteriores) => anteriores.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    }
  }

  async function marcarTodas() {
    try {
      await marcarTodasLeidas();
      setNotificaciones((anteriores) => anteriores.map((n) => ({ ...n, read: true })));
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    }
  }

  const sinLeer = notificaciones.filter((n) => !n.read).length;
  const visibles = soloSinLeer ? notificaciones.filter((n) => !n.read) : notificaciones;

  return (
    <div className="pagina">
      <Cabecera />
      <main className="contenedor">
        <div className="tarjeta">
          <div className="encabezado-seccion">
            <h1>Notificaciones</h1>
            {sinLeer > 0 && (
              <button type="button" className="boton boton-secundario boton-auto" onClick={marcarTodas}>
                Marcar todas como leídas
              </button>
            )}
          </div>
          <p className="texto-suave">
            Avisos sobre tus citas (nuevas, confirmadas, reprogramadas o canceladas) y sobre tu cuenta.
          </p>
          <div className="pestanas" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!soloSinLeer}
              className={`pestana ${!soloSinLeer ? "pestana-activa" : ""}`}
              onClick={() => setSoloSinLeer(false)}
            >
              Todas <span className="pestana-total">{notificaciones.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={soloSinLeer}
              className={`pestana ${soloSinLeer ? "pestana-activa" : ""}`}
              onClick={() => setSoloSinLeer(true)}
            >
              Sin leer <span className="pestana-total">{sinLeer}</span>
            </button>
          </div>
        </div>

        <Alerta
          tipo="error"
          mensajes={errores}
          onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined}
        />

        <div className="tarjeta notificaciones">
          {cargando && (
            <div className="lista-notificaciones" aria-busy="true" aria-label="Cargando notificaciones">
              <div className="esqueleto" style={{ height: 64 }} />
              <div className="esqueleto" style={{ height: 64 }} />
              <div className="esqueleto" style={{ height: 64 }} />
            </div>
          )}
          {!cargando && visibles.length === 0 && errores.length === 0 && (
            <div className="estado-vacio estado-vacio-compacto">
              <span className="estado-vacio-icono">
                <Icono nombre="campana" tamano={26} />
              </span>
              <div>
                <h2>{soloSinLeer ? "Estás al día" : "Aún no tienes notificaciones"}</h2>
                <p className="texto-suave">
                  {soloSinLeer
                    ? "No tienes notificaciones sin leer."
                    : "Te avisaremos aquí cuando confirmen, cambien o se acerque una cita."}
                </p>
              </div>
            </div>
          )}
          <ul className="lista-notificaciones">
            {visibles.map((n) => (
              <li key={n.id} className={n.read ? "notificacion-leida" : "notificacion-nueva"}>
                <span className="notificacion-icono" aria-hidden="true">
                  <Icono nombre="campana" tamano={18} />
                </span>
                <div>
                  <p>{n.message}</p>
                  <span className="texto-suave">{formatearMomento(n.createdAt)}</span>
                </div>
                {!n.read && (
                  <button type="button" className="enlace-accion" onClick={() => marcarLeida(n.id)}>
                    Marcar como leída
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}

export default NotificacionesPagina;
