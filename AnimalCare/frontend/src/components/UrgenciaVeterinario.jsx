// Urgencias, vista del veterinario: recibe las urgencias mientras esta dentro de su
// horario (Mi horario), acepta una y la atiende. Aceptarla ocupa su agenda.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Alerta from "./Alerta";
import { useSondeo } from "../hooks/useSondeo";
import {
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
import { iniciarCita } from "../services/appointment.service";
import { obtenerMensajesDeError } from "../services/api";

function UrgenciaVeterinario() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState(null); // { available, canAttend }
  const [conflicto, setConflicto] = useState(null); // aceptar choca con citas: { id, message, conflicts }
  const [abiertas, setAbiertas] = useState([]);
  const [mias, setMias] = useState({ active: null, emergencies: [] });
  const [cargado, setCargado] = useState(false);
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);
  const [ocupado, setOcupado] = useState(null);
  const [confirmandoLiberar, setConfirmandoLiberar] = useState(false);

  async function cargar() {
    try {
      const [lista, propias] = await Promise.all([urgenciasAbiertas(), misUrgencias()]);
      setEstado({ available: lista.available, canAttend: lista.canAttend });
      setAbiertas(lista.requests);
      setMias(propias);
    } catch {
      // Un fallo de red pasajero no debe tapar lo que ya se mostraba.
    } finally {
      setCargado(true);
    }
  }

  useSondeo(cargar, INTERVALO_SONDEO_MS);

  // Iniciar la atencion lleva a la historia clinica de la mascota, ligada a la cita de la urgencia.
  async function iniciarAtencion(urgencia) {
    setErrores([]);
    setExito([]);
    setOcupado("iniciar");
    try {
      await iniciarCita(urgencia.appointment.id);
      navigate(`/pacientes/${urgencia.pet.id}?cita=${urgencia.appointment.id}`);
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
      setOcupado(null);
    }
  }

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

  // Aceptar: si hay citas que se cruzan, se pide confirmar antes de cancelarlas.
  async function aceptar(id, reagendar = false) {
    setErrores([]);
    setExito([]);
    setOcupado(`aceptar-${id}`);
    try {
      const r = await aceptarUrgencia(id, reagendar);
      setConflicto(null);
      setExito([r.message]);
    } catch (error) {
      const datos = error.response?.data;
      if (datos?.code === "APPOINTMENT_CONFLICT") {
        setConflicto({ id, message: datos.message, conflicts: datos.conflicts });
      } else {
        setConflicto(null);
        setErrores(obtenerMensajesDeError(error));
      }
    } finally {
      setOcupado(null);
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
          Recibes los avisos de dueños con una urgencia cuando estás dentro de tu horario de atención. El primero que
          acepta se queda con el caso y la urgencia ocupa tu agenda por 30 minutos.
        </p>
      </div>

      <Alerta tipo="exito" mensajes={exito} />
      <Alerta tipo="error" mensajes={errores} />

      {!cargado && <p className="texto-suave">Cargando...</p>}

      {estado && (
        <div className="tarjeta">
          <h3>Mi disponibilidad</h3>
          {!estado.canAttend ? (
            <p className="texto-suave">Tu cuenta debe estar aprobada por el administrador para atender urgencias.</p>
          ) : estado.available ? (
            <span className="etiqueta etiqueta-confirmed">Disponible: estás dentro de tu horario</span>
          ) : (
            <p className="texto-suave">
              Ahora no recibes urgencias: estás fuera de tu horario de atención, tienes un bloqueo en la agenda o ya
              atiendes una urgencia. Revisa <Link to="/mi-horario">Mi horario</Link>.
            </p>
          )}
        </div>
      )}

      {activa && (
        <div className="tarjeta urgencia-estado urgencia-aceptada" role="status">
          <div className="urgencia-detalle">
            <h3>
              Urgencia en curso
              {activa.appointment?.status === "IN_PROGRESS" && (
                <span className="etiqueta etiqueta-confirmed urgencia-etiqueta-atencion"> En atención</span>
              )}
            </h3>
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
              {activa.pet && activa.appointment?.status === "IN_PROGRESS" && (
                <Link
                  to={`/pacientes/${activa.pet.id}?cita=${activa.appointment.id}`}
                  className="boton boton-primario boton-auto"
                >
                  Continuar atención
                </Link>
              )}
              {activa.pet && activa.appointment && activa.appointment.status !== "IN_PROGRESS" && (
                <button
                  type="button"
                  className="boton boton-primario boton-auto"
                  disabled={ocupado === "iniciar"}
                  onClick={() => iniciarAtencion(activa)}
                >
                  Iniciar atención
                </button>
              )}
              {!activa.pet && (
                <button
                  type="button"
                  className="boton boton-primario boton-auto"
                  disabled={ocupado === "completar"}
                  onClick={() => ejecutar("completar", () => completarUrgencia(activa.id))}
                >
                  Terminar atención
                </button>
              )}
              {activa.appointment?.status === "IN_PROGRESS" ? null : confirmandoLiberar ? (
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

      {conflicto && (
        <div className="tarjeta" role="alertdialog" aria-label="Citas que se cruzan">
          <h3>Tienes citas en ese horario</h3>
          <p>{conflicto.message}</p>
          <ul>
            {conflicto.conflicts.map((c) => (
              <li key={c.id}>
                {c.client} · {horaLocal(c.scheduledAt)} ({c.durationMinutes} min)
              </li>
            ))}
          </ul>
          <div className="acciones-linea">
            <button
              type="button"
              className="boton boton-peligro-solido boton-auto"
              disabled={ocupado === `aceptar-${conflicto.id}`}
              onClick={() => aceptar(conflicto.id, true)}
            >
              Aceptar y pedir que reagenden
            </button>
            <button type="button" className="boton boton-secundario boton-auto" onClick={() => setConflicto(null)}>
              No aceptar
            </button>
          </div>
        </div>
      )}

      {estado?.available && (
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
                    className="boton boton-primario boton-auto"
                    disabled={ocupado === `aceptar-${u.id}` || Boolean(activa)}
                    title={activa ? "Termina la urgencia en curso para aceptar otra" : undefined}
                    onClick={() => aceptar(u.id)}
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
