// Urgencias, vista del veterinario: ponerse de turno, aceptar urgencias abiertas
// y atender la que tiene en curso.
import { useState } from "react";
import { Link } from "react-router-dom";

import Alerta from "./Alerta";
import { useSondeo } from "../hooks/useSondeo";
import {
  estadoDeTurno,
  ponerseDeTurno,
  urgenciasAbiertas,
  misUrgencias,
  aceptarUrgencia,
  completarUrgencia,
  liberarUrgencia,
  ESTADOS_URGENCIA,
  INTERVALO_SONDEO_MS,
  haceCuanto,
  horaLocal,
} from "../services/emergency.service";
import { MODALIDADES } from "../services/vet.service";
import { obtenerMensajesDeError } from "../services/api";

function UrgenciaVeterinario() {
  const [turno, setTurno] = useState(null);
  const [abiertas, setAbiertas] = useState([]);
  const [mias, setMias] = useState({ active: null, emergencies: [] });
  const [cargado, setCargado] = useState(false);
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);
  const [ocupado, setOcupado] = useState(null);
  const [confirmandoLiberar, setConfirmandoLiberar] = useState(false);

  async function cargar() {
    try {
      const t = await estadoDeTurno();
      setTurno(t);
      const [lista, propias] = await Promise.all([
        t.active ? urgenciasAbiertas() : Promise.resolve({ requests: [] }),
        misUrgencias(),
      ]);
      setAbiertas(lista.requests);
      setMias(propias);
    } catch {
      // Un fallo de red pasajero no debe tapar lo que ya se mostraba.
    } finally {
      setCargado(true);
    }
  }

  useSondeo(cargar, INTERVALO_SONDEO_MS);

  async function ejecutar(clave, accion) {
    setErrores([]);
    setExito([]);
    setOcupado(clave);
    try {
      const r = await accion();
      setExito([r.message]);
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setOcupado(null);
      setConfirmandoLiberar(false);
      await cargar();
    }
  }

  const activa = mias.active;
  const historial = mias.emergencies.filter((u) => !activa || u.id !== activa.id);

  return (
    <>
      <div className="tarjeta">
        <h1>Urgencias</h1>
        <p className="texto-suave">
          Ponte de turno para recibir los avisos de dueños que necesitan atención urgente. El primero que acepta se
          queda con el caso.
        </p>
      </div>

      <Alerta tipo="exito" mensajes={exito} />
      <Alerta tipo="error" mensajes={errores} />

      {!cargado && <p className="texto-suave">Cargando...</p>}

      {turno && (
        <div className="tarjeta">
          <h3>Mi turno</h3>
          {!turno.canGoOnDuty && !turno.active ? (
            <p className="texto-suave">
              Tu cuenta debe estar aprobada por el administrador para atender urgencias.
            </p>
          ) : turno.active ? (
            <div className="acciones-linea">
              <span className="etiqueta etiqueta-confirmed">De turno hasta las {horaLocal(turno.until)}</span>
              <button
                type="button"
                className="boton boton-secundario boton-auto"
                disabled={ocupado === "turno"}
                onClick={() => ejecutar("turno", () => ponerseDeTurno(0))}
              >
                Salir de turno
              </button>
            </div>
          ) : (
            <>
              <p className="texto-suave">Estás fuera de turno. Elige por cuánto tiempo quieres recibir urgencias:</p>
              <div className="acciones-linea">
                {turno.hoursOptions.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="boton boton-primario boton-auto"
                    disabled={ocupado === "turno"}
                    onClick={() => ejecutar("turno", () => ponerseDeTurno(h))}
                  >
                    De turno {h} horas
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activa && (
        <div className="tarjeta urgencia-estado urgencia-aceptada" role="status">
          <div className="urgencia-detalle">
            <h3>Urgencia en curso</h3>
            <p>
              <strong>{activa.client.name}</strong>
              {activa.pet && (
                <>
                  {" · "}
                  {activa.pet.name} ({activa.pet.species})
                </>
              )}
            </p>
            <p>
              Llámalo: <a href={`tel:${activa.phone}`}>{activa.phone}</a>
            </p>
            <p>
              {MODALIDADES[activa.mode]}
              {activa.mode === "HOME" && activa.address ? ` · ${activa.address}` : ""}
            </p>
            <p className="texto-suave">“{activa.symptoms}” · aceptada {haceCuanto(activa.acceptedAt)}</p>

            <div className="acciones-linea">
              {activa.pet && (
                <Link to={`/pacientes/${activa.pet.id}`} className="boton boton-secundario boton-auto">
                  Ver historia clínica
                </Link>
              )}
              <button
                type="button"
                className="boton boton-primario boton-auto"
                disabled={ocupado === "completar"}
                onClick={() => ejecutar("completar", () => completarUrgencia(activa.id))}
              >
                Marcar como atendida
              </button>
              {confirmandoLiberar ? (
                <span className="acciones-linea" role="alertdialog">
                  <strong>¿No puedes atenderla?</strong>
                  <button
                    type="button"
                    className="boton boton-peligro boton-auto"
                    disabled={ocupado === "liberar"}
                    onClick={() => ejecutar("liberar", () => liberarUrgencia(activa.id))}
                  >
                    Sí, liberarla
                  </button>
                  <button type="button" className="boton boton-secundario boton-auto" onClick={() => setConfirmandoLiberar(false)}>
                    No
                  </button>
                </span>
              ) : (
                <button type="button" className="boton boton-peligro boton-auto" onClick={() => setConfirmandoLiberar(true)}>
                  No puedo atenderla
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {turno?.active && (
        <div className="tarjeta">
          <h3>Urgencias abiertas ({abiertas.length})</h3>
          {abiertas.length === 0 ? (
            <p className="texto-suave">No hay urgencias abiertas ahora. Esta pantalla se actualiza sola.</p>
          ) : (
            <ul className="urgencia-lista">
              {abiertas.map((u) => (
                <li key={u.id} className="urgencia-item">
                  <div>
                    <p>
                      <strong>{u.client.name}</strong>
                      {u.pet && (
                        <>
                          {" · "}
                          {u.pet.name} ({u.pet.species})
                        </>
                      )}
                    </p>
                    <p>“{u.symptoms}”</p>
                    <p className="texto-suave">
                      {MODALIDADES[u.mode]}
                      {u.mode === "HOME" && u.address ? ` · ${u.address}` : ""} · {haceCuanto(u.createdAt)} · vence a las{" "}
                      {horaLocal(u.expiresAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="boton boton-peligro-solido boton-auto"
                    disabled={ocupado === `aceptar-${u.id}` || Boolean(activa)}
                    title={activa ? "Termina la urgencia en curso para aceptar otra" : undefined}
                    onClick={() => ejecutar(`aceptar-${u.id}`, () => aceptarUrgencia(u.id))}
                  >
                    Aceptar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {historial.length > 0 && (
        <div className="tarjeta">
          <h3>Urgencias que atendí</h3>
          <ul className="urgencia-historial">
            {historial.map((u) => (
              <li key={u.id}>
                <div>
                  <strong>{u.client.name}</strong>
                  {u.pet && <span className="texto-suave"> · {u.pet.name}</span>}
                  <p className="texto-suave">“{u.symptoms}”</p>
                </div>
                <span className={`etiqueta etiqueta-urgencia-${u.status.toLowerCase()}`}>{ESTADOS_URGENCIA[u.status]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default UrgenciaVeterinario;
