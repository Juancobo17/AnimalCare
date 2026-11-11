// AN-31: horario base semanal y bloqueos excepcionales de la agenda.
import { useEffect, useState } from "react";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import {
  obtenerMiHorario,
  guardarMiHorario,
  listarMisBloqueos,
  crearBloqueo,
  eliminarBloqueo,
} from "../services/vetPanel.service";
import { DIAS_SEMANA } from "../services/vet.service";
import { formatearFecha } from "../services/appointment.service";
import { obtenerMensajesDeError } from "../services/api";
import { hoyLocal } from "../services/zona";

// Lunes primero, domingo al final.
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

// Fecha de hoy en "AAAA-MM-DD", en la zona de la clinica.
function hoy() {
  return hoyLocal();
}

// ---------- Horario semanal ----------
// Una fila por día: un interruptor "Atiende" y sus franjas. Así se ve la
// semana completa de un vistazo, como en las agendas en línea habituales.

const FRANJA_NUEVA = { startTime: "09:00", endTime: "13:00" };

function agruparPorDia(franjas) {
  const porDia = Object.fromEntries(ORDEN_DIAS.map((d) => [d, []]));
  for (const f of franjas) porDia[f.weekday].push({ startTime: f.startTime, endTime: f.endTime });
  for (const d of ORDEN_DIAS) porDia[d].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return porDia;
}

function HorarioSemanal() {
  const [porDia, setPorDia] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);

  useEffect(() => {
    obtenerMiHorario()
      .then((franjas) => setPorDia(agruparPorDia(franjas)))
      .catch((error) => {
        setPorDia(agruparPorDia([]));
        setErrores(obtenerMensajesDeError(error));
      });
  }, []);

  function cambiarDia(dia, franjas) {
    setExito([]);
    setPorDia((a) => ({ ...a, [dia]: franjas }));
  }

  function alternarDia(dia, atiende) {
    cambiarDia(dia, atiende ? [{ ...FRANJA_NUEVA }, { startTime: "14:00", endTime: "18:00" }] : []);
  }

  function cambiarFranja(dia, indice, campo, valor) {
    cambiarDia(
      dia,
      porDia[dia].map((f, i) => (i === indice ? { ...f, [campo]: valor } : f))
    );
  }

  // Copia las franjas de un día a lunes–viernes.
  function copiarALaborales(dia) {
    setExito([]);
    setPorDia((a) => {
      const copia = { ...a };
      for (const d of [1, 2, 3, 4, 5]) copia[d] = a[dia].map((f) => ({ ...f }));
      return copia;
    });
  }

  async function guardar() {
    setErrores([]);
    setExito([]);
    setGuardando(true);
    try {
      const franjas = ORDEN_DIAS.flatMap((d) => porDia[d].map((f) => ({ weekday: d, ...f })));
      const resultado = await guardarMiHorario(franjas);
      setPorDia(agruparPorDia(resultado.availabilities));
      setExito([resultado.message]);
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="tarjeta">
      <h3>Horario semanal</h3>
      <p className="texto-suave">
        Marca los días que atiendes y sus franjas. El sistema calcula los turnos de cada semana. Las
        citas ya agendadas no cambian.
      </p>

      <Alerta tipo="exito" mensajes={exito} />
      <Alerta tipo="error" mensajes={errores} />

      {!porDia && <p className="texto-suave">Cargando horario...</p>}

      {porDia && (
        <>
          <div className="semana">
            {ORDEN_DIAS.map((dia) => {
              const franjas = porDia[dia];
              const atiende = franjas.length > 0;
              return (
                <div key={dia} className={`semana-dia ${atiende ? "" : "semana-dia-libre"}`}>
                  <label className="semana-nombre">
                    <input
                      type="checkbox"
                      checked={atiende}
                      onChange={(e) => alternarDia(dia, e.target.checked)}
                    />
                    {DIAS_SEMANA[dia]}
                  </label>

                  <div className="semana-franjas">
                    {!atiende && <span className="texto-suave">No atiende</span>}
                    {franjas.map((f, i) => (
                      <div className="franja" key={i}>
                        <input
                          type="time"
                          step="1800"
                          aria-label={`${DIAS_SEMANA[dia]}: desde`}
                          value={f.startTime}
                          onChange={(e) => cambiarFranja(dia, i, "startTime", e.target.value)}
                        />
                        <span className="texto-suave">a</span>
                        <input
                          type="time"
                          step="1800"
                          aria-label={`${DIAS_SEMANA[dia]}: hasta`}
                          value={f.endTime}
                          onChange={(e) => cambiarFranja(dia, i, "endTime", e.target.value)}
                        />
                        <button
                          type="button"
                          className="boton-icono"
                          aria-label={`Quitar franja ${f.startTime} a ${f.endTime}`}
                          onClick={() => cambiarDia(dia, franjas.filter((_, j) => j !== i))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  {atiende && (
                    <div className="semana-acciones">
                      <button
                        type="button"
                        className="enlace-accion"
                        onClick={() => cambiarDia(dia, [...franjas, { startTime: "14:00", endTime: "18:00" }])}
                      >
                        + Franja
                      </button>
                      {dia >= 1 && dia <= 5 && (
                        <button type="button" className="enlace-accion" onClick={() => copiarALaborales(dia)}>
                          Copiar a lun–vie
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button type="button" className="boton boton-primario boton-auto" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar horario"}
          </button>
        </>
      )}
    </div>
  );
}

// ---------- Bloqueos ----------

const BLOQUEO_VACIO = { date: "", allDay: true, startTime: "08:00", endTime: "12:00", reason: "" };

function Bloqueos() {
  const [bloqueos, setBloqueos] = useState([]);
  const [datos, setDatos] = useState(BLOQUEO_VACIO);
  const [conflictos, setConflictos] = useState(null);
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);
  const [enviando, setEnviando] = useState(false);

  function cargar() {
    return listarMisBloqueos()
      .then(setBloqueos)
      .catch((error) => setErrores(obtenerMensajesDeError(error)));
  }

  useEffect(() => {
    cargar();
  }, []);

  function cambiar(evento) {
    const { name, value, type, checked } = evento.target;
    setDatos((anterior) => ({ ...anterior, [name]: type === "checkbox" ? checked : value }));
    // Si cambia el rango, el aviso de conflicto anterior ya no aplica.
    setConflictos(null);
  }

  async function enviar(confirmar) {
    setErrores([]);
    setExito([]);

    if (datos.date === "") {
      setErrores(["Debes indicar la fecha que quieres bloquear."]);
      return;
    }

    setEnviando(true);
    try {
      const resultado = await crearBloqueo({
        date: datos.date,
        allDay: datos.allDay,
        startTime: datos.allDay ? undefined : datos.startTime,
        endTime: datos.allDay ? undefined : datos.endTime,
        reason: datos.reason.trim(),
        confirm: confirmar,
      });
      setExito([resultado.message]);
      setDatos(BLOQUEO_VACIO);
      setConflictos(null);
      await cargar();
    } catch (error) {
      // AN-31 criterio 4: hay citas en ese rango; se pregunta antes de seguir.
      if (error.response?.status === 409 && error.response.data?.code === "BLOCK_CONFLICT") {
        setConflictos(error.response.data);
      } else {
        setErrores(obtenerMensajesDeError(error));
      }
    } finally {
      setEnviando(false);
    }
  }

  async function quitar(id) {
    setErrores([]);
    setExito([]);
    try {
      const resultado = await eliminarBloqueo(id);
      setExito([resultado.message]);
      await cargar();
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    }
  }

  return (
    <div className="tarjeta">
      <h3>Bloqueos y excepciones</h3>
      <p className="texto-suave">
        Marca un día o un rango de horas en que no estarás disponible. Esos turnos dejan de
        ofrecerse a los dueños de mascotas.
      </p>

      <Alerta tipo="exito" mensajes={exito} />
      <Alerta tipo="error" mensajes={errores} />

      <form
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          enviar(false);
        }}
      >
        <div className="fila">
          <div className="campo">
            <label htmlFor="bloqueo-fecha">
              Fecha <span className="obligatorio">*</span>
            </label>
            <input id="bloqueo-fecha" type="date" name="date" min={hoy()} value={datos.date} onChange={cambiar} />
          </div>
          <div className="campo">
            <label htmlFor="bloqueo-motivo">Motivo (opcional)</label>
            <input
              id="bloqueo-motivo"
              name="reason"
              maxLength={150}
              value={datos.reason}
              onChange={cambiar}
              placeholder="Capacitación, cita médica..."
            />
          </div>
        </div>

        <label className="casilla">
          <input type="checkbox" name="allDay" checked={datos.allDay} onChange={cambiar} />
          Todo el día
        </label>

        {!datos.allDay && (
          <div className="fila">
            <div className="campo">
              <label htmlFor="bloqueo-desde">Desde</label>
              <input id="bloqueo-desde" type="time" name="startTime" step="1800" value={datos.startTime} onChange={cambiar} />
            </div>
            <div className="campo">
              <label htmlFor="bloqueo-hasta">Hasta</label>
              <input id="bloqueo-hasta" type="time" name="endTime" step="1800" value={datos.endTime} onChange={cambiar} />
            </div>
          </div>
        )}

        {conflictos ? (
          <div className="alerta alerta-error" role="alertdialog">
            <strong>{conflictos.message}</strong>
            <ul>
              {conflictos.conflicts.map((cita) => (
                <li key={cita.id}>
                  {cita.time} · {cita.client?.name} · {cita.service ? cita.service.name : "Consulta general"}
                </li>
              ))}
            </ul>
            <div className="acciones-linea">
              <button
                type="button"
                className="boton boton-peligro boton-auto"
                onClick={() => enviar(true)}
                disabled={enviando}
              >
                Bloquear y cancelar citas
              </button>
              <button type="button" className="boton boton-secundario boton-auto" onClick={() => setConflictos(null)}>
                No bloquear
              </button>
            </div>
          </div>
        ) : (
          <button type="submit" className="boton boton-primario boton-auto" disabled={enviando}>
            {enviando ? "Bloqueando..." : "Bloquear horario"}
          </button>
        )}
      </form>

      <h4 className="titulo-seccion">Próximos bloqueos</h4>
      {bloqueos.length === 0 ? (
        <p className="texto-suave">No tienes bloqueos programados.</p>
      ) : (
        <ul className="lista-servicios">
          {bloqueos.map((bloqueo) => (
            <li key={bloqueo.id}>
              <div>
                <strong>{formatearFecha(bloqueo.date)}</strong>
                <span className="texto-suave">
                  {" "}
                  · {bloqueo.allDay ? "Todo el día" : `${bloqueo.startTime} a ${bloqueo.endTime}`}
                </span>
                {bloqueo.reason && <p className="texto-suave">{bloqueo.reason}</p>}
              </div>
              <button type="button" className="boton boton-secundario boton-auto" onClick={() => quitar(bloqueo.id)}>
                Quitar bloqueo
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MiHorario() {
  return (
    <div className="pagina">
      <Cabecera />
      <main className="contenedor">
        <div className="tarjeta">
          <h1>Mi horario</h1>
          <p className="texto-suave">Configura cuándo atiendes y bloquea los días que no estarás.</p>
        </div>
        <HorarioSemanal />
        <Bloqueos />
      </main>
    </div>
  );
}

export default MiHorario;
