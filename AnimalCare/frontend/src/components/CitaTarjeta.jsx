// Tarjeta de una cita. Se usa en el panel y en el listado de citas.
//
// perspectiva indica quien la esta mirando: el cliente ve con que veterinario
// es la cita, y el veterinario ve que cliente la agendo.
//
// onActualizada es opcional: si se pasa, la tarjeta muestra las acciones
// que correspondan y avisa con la cita nueva y el mensaje del backend.
//   Cliente:      cancelar hasta 2 horas antes (AN-14) y calificar despues
//                 de una cita atendida
//   Veterinario:  confirmar, reprogramar, cancelar con motivo (AN-15, AN-16)
//                 y marcar como atendida
import { useState } from "react";
import { Link } from "react-router-dom";

import { MODALIDADES, obtenerHorarios } from "../services/vet.service";
import {
  ESTADOS_CITA,
  formatearFecha,
  esCancelable,
  esCompletable,
  inicioDeCita,
  cancelarCita,
  reprogramarCita,
  confirmarCita,
  completarCita,
  calificarCita,
  clientePuedeCancelar,
  HORAS_MINIMAS_CANCELACION,
  hoyLocal,
} from "../services/appointment.service";
import { ICONO_ESPECIE } from "../services/pet.service";
import { obtenerMensajesDeError } from "../services/api";

function FormularioReprogramar({ cita, onListo, onCerrar }) {
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [horarios, setHorarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function elegirFecha(valor) {
    setFecha(valor);
    setHora("");
    setError("");
    if (!valor) return;
    setCargando(true);
    try {
      const resultado = await obtenerHorarios(cita.vet.id, {
        date: valor,
        mode: cita.mode,
        serviceId: cita.service?.id,
      }).catch(() => obtenerHorarios(cita.vet.id, { date: valor, mode: cita.mode }));
      setHorarios(resultado.slots);
    } catch (e) {
      setHorarios([]);
      setError(obtenerMensajesDeError(e)[0]);
    } finally {
      setCargando(false);
    }
  }

  async function guardar() {
    if (!fecha || !hora) {
      setError("Elige la nueva fecha y la nueva hora.");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      const resultado = await reprogramarCita(cita.id, { date: fecha, time: hora, reason: motivo.trim() });
      onListo(resultado);
    } catch (e) {
      setError(obtenerMensajesDeError(e).join(" "));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="cita-panel" role="group" aria-label="Reprogramar cita">
      <div className="fila">
        <div className="campo">
          <label htmlFor={`fecha-${cita.id}`}>Nueva fecha</label>
          <input id={`fecha-${cita.id}`} type="date" min={hoyLocal()} value={fecha} onChange={(e) => elegirFecha(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor={`hora-${cita.id}`}>Nueva hora</label>
          <select
            id={`hora-${cita.id}`}
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            disabled={!fecha || cargando || horarios.length === 0}
          >
            <option value="">
              {!fecha ? "Elige primero la fecha" : cargando ? "Buscando..." : horarios.length === 0 ? "Sin horarios libres" : "Elige una hora"}
            </option>
            {horarios.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="campo">
        <label htmlFor={`motivo-r-${cita.id}`}>Motivo para el cliente (opcional)</label>
        <input id={`motivo-r-${cita.id}`} maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      {error && <p className="error-campo">{error}</p>}
      <div className="acciones-linea">
        <button type="button" className="boton boton-primario boton-auto" onClick={guardar} disabled={enviando}>
          {enviando ? "Guardando..." : "Guardar nuevo horario"}
        </button>
        <button type="button" className="boton boton-secundario boton-auto" onClick={onCerrar} disabled={enviando}>
          Volver
        </button>
      </div>
    </div>
  );
}

function FormularioCalificar({ cita, onListo, onCerrar }) {
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function enviar() {
    if (estrellas === 0) {
      setError("Elige de 1 a 5 estrellas.");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      onListo(await calificarCita(cita.id, { rating: estrellas, comment: comentario.trim() }));
    } catch (e) {
      setError(obtenerMensajesDeError(e).join(" "));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="cita-panel" role="group" aria-label="Calificar la atención">
      <strong>¿Cómo te fue con {cita.vet?.name}?</strong>
      <div className="estrellas-selector" role="radiogroup" aria-label="Calificación">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={estrellas === n}
            aria-label={`${n} de 5`}
            className={n <= estrellas ? "estrella llena" : "estrella"}
            onClick={() => setEstrellas(n)}
          >
            ★
          </button>
        ))}
      </div>
      <div className="campo">
        <label htmlFor={`comentario-${cita.id}`}>Comentario (opcional)</label>
        <textarea
          id={`comentario-${cita.id}`}
          rows={2}
          maxLength={500}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Cuéntales a otros dueños cómo fue la atención."
        />
      </div>
      {error && <p className="error-campo">{error}</p>}
      <div className="acciones-linea">
        <button type="button" className="boton boton-primario boton-auto" onClick={enviar} disabled={enviando}>
          {enviando ? "Enviando..." : "Enviar calificación"}
        </button>
        <button type="button" className="boton boton-secundario boton-auto" onClick={onCerrar} disabled={enviando}>
          Ahora no
        </button>
      </div>
    </div>
  );
}

function CitaTarjeta({ cita, perspectiva = "cliente", onActualizada }) {
  const esVistaDelVeterinario = perspectiva === "veterinario";
  // null | "cancelar" | "reprogramar"
  const [panel, setPanel] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");

  const conAcciones = Boolean(onActualizada);
  // El cliente solo cancela hasta N horas antes; el veterinario, hasta la hora de la cita.
  const cancelable = conAcciones && (esVistaDelVeterinario ? esCancelable(cita) : clientePuedeCancelar(cita));
  const fueraDePlazo = conAcciones && !esVistaDelVeterinario && esCancelable(cita) && !clientePuedeCancelar(cita);
  const calificable = conAcciones && !esVistaDelVeterinario && cita.status === "COMPLETED" && !cita.review;
  const confirmable = conAcciones && esVistaDelVeterinario && cancelable && cita.status === "PENDING";
  const completable = conAcciones && esVistaDelVeterinario && esCompletable(cita);

  // En atención a domicilio la dirección es la del cliente;
  // en la veterinaria, la del consultorio.
  // El veterinario ya conoce la direccion de su consultorio: solo ve la del cliente.
  const direccion = cita.mode === "HOME" ? cita.address : esVistaDelVeterinario ? null : cita.vet?.address;

  async function ejecutar(accion) {
    setProcesando(true);
    setError("");
    try {
      const resultado = await accion();
      setPanel(null);
      setMotivo("");
      onActualizada(resultado);
    } catch (e) {
      setError(obtenerMensajesDeError(e).join(" "));
    } finally {
      setProcesando(false);
    }
  }

  return (
    <article className="cita">
      <div className="cita-fecha">
        <span className="cita-hora">{cita.time}</span>
        <span className="cita-dia">{formatearFecha(cita.date)}</span>
      </div>

      <div className="cita-datos">
        <h4>
          {esVistaDelVeterinario ? cita.client?.name : cita.vet?.name}
          {!esVistaDelVeterinario && cita.vet?.specialty && (
            <span className="texto-suave"> · {cita.vet.specialty}</span>
          )}
        </h4>

        <p className="texto-suave">
          {cita.service ? cita.service.name : "Consulta general"} · {cita.durationMinutes} min ·{" "}
          {MODALIDADES[cita.mode]}
        </p>

        {cita.pet && (
          <p className="texto-suave">
            {ICONO_ESPECIE[cita.pet.species] || "🐾"} {cita.pet.name} ({cita.pet.species})
            {esVistaDelVeterinario && cita.status !== "CANCELLED" && (
              <>
                {" · "}
                <Link to={`/pacientes/${cita.pet.id}`}>Ver historia clínica</Link>
              </>
            )}
          </p>
        )}
        {direccion && <p className="texto-suave">📍 {direccion}</p>}
        {esVistaDelVeterinario && cita.client?.email && (
          <p className="texto-suave">✉ {cita.client.email}</p>
        )}
        {cita.notes && <p className="cita-notas">“{cita.notes}”</p>}

        {cita.review && (
          <p className="cita-resena">
            <span className="calificacion-estrellas" aria-label={`${cita.review.rating} de 5`}>
              {"★".repeat(cita.review.rating)}
              {"☆".repeat(5 - cita.review.rating)}
            </span>
            {cita.review.comment && <span className="texto-suave"> “{cita.review.comment}”</span>}
          </p>
        )}

        {fueraDePlazo && (
          <p className="ayuda">
            Faltan menos de {HORAS_MINIMAS_CANCELACION} horas: para cancelar, comunícate con el veterinario
            {cita.vet?.phone ? ` al ${cita.vet.phone}` : ""}.
          </p>
        )}

        {error && <p className="error-campo">{error}</p>}

        {/* AN-18: despues de la consulta, registrarla en la historia de la mascota. */}
        {conAcciones &&
          esVistaDelVeterinario &&
          cita.pet &&
          cita.status !== "CANCELLED" &&
          !cita.medicalRecordId &&
          inicioDeCita(cita).getTime() <= Date.now() && (
            <div className="cita-acciones">
              <Link to={`/pacientes/${cita.pet.id}?cita=${cita.id}`} className="boton boton-secundario boton-auto">
                Registrar en historia clínica
              </Link>
            </div>
          )}
        {esVistaDelVeterinario && cita.medicalRecordId && (
          <p className="ayuda">✓ Registrada en la historia clínica.</p>
        )}

        {panel === null && calificable && (
          <div className="cita-acciones">
            <button type="button" className="boton boton-primario boton-auto" onClick={() => setPanel("calificar")}>
              ★ Calificar atención
            </button>
          </div>
        )}

        {panel === "calificar" && (
          <FormularioCalificar
            cita={cita}
            onCerrar={() => setPanel(null)}
            onListo={(resultado) => {
              setPanel(null);
              onActualizada(resultado);
            }}
          />
        )}

        {panel === null && (cancelable || completable) && (
          <div className="cita-acciones">
            {confirmable && (
              <button
                type="button"
                className="boton boton-primario boton-auto"
                disabled={procesando}
                onClick={() => ejecutar(() => confirmarCita(cita.id))}
              >
                Confirmar
              </button>
            )}
            {completable && (
              <button
                type="button"
                className="boton boton-primario boton-auto"
                disabled={procesando}
                onClick={() => ejecutar(() => completarCita(cita.id))}
              >
                Marcar como atendida
              </button>
            )}
            {esVistaDelVeterinario && cancelable && (
              <button type="button" className="boton boton-secundario boton-auto" onClick={() => setPanel("reprogramar")}>
                Reprogramar
              </button>
            )}
            {cancelable && (
              <button type="button" className="boton boton-peligro boton-auto" onClick={() => setPanel("cancelar")}>
                Cancelar cita
              </button>
            )}
          </div>
        )}

        {panel === "cancelar" && (
          <div className="cita-panel" role="alertdialog" aria-label="Confirmar cancelación">
            <strong>¿Seguro que quieres cancelar esta cita?</strong>
            {esVistaDelVeterinario && (
              <div className="campo">
                <label htmlFor={`motivo-${cita.id}`}>Motivo para el cliente (opcional)</label>
                <input id={`motivo-${cita.id}`} maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
            )}
            <div className="acciones-linea">
              <button
                type="button"
                className="boton boton-peligro boton-auto"
                disabled={procesando}
                onClick={() => ejecutar(() => cancelarCita(cita.id, motivo.trim()))}
              >
                {procesando ? "Cancelando..." : "Sí, cancelar"}
              </button>
              <button
                type="button"
                className="boton boton-secundario boton-auto"
                disabled={procesando}
                onClick={() => setPanel(null)}
              >
                No, volver
              </button>
            </div>
          </div>
        )}

        {panel === "reprogramar" && (
          <FormularioReprogramar
            cita={cita}
            onCerrar={() => setPanel(null)}
            onListo={(resultado) => {
              setPanel(null);
              onActualizada(resultado);
            }}
          />
        )}
      </div>

      <span className={`etiqueta etiqueta-${cita.status.toLowerCase()}`}>
        {ESTADOS_CITA[cita.status]}
      </span>
    </article>
  );
}

export default CitaTarjeta;
