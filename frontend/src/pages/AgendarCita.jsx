// Agendamiento de una cita, paso a paso.
//
// Reune tres historias del sprint:
// AN-10 elegir atención a domicilio
// AN-11 elegir atención en la veterinaria
// AN-13 escoger fecha y hora entre los horarios libres del veterinario
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import { obtenerVeterinario, obtenerHorarios, MODALIDADES } from "../services/vet.service";
import { agendarCita, formatearFecha } from "../services/appointment.service";
import { obtenerMensajesDeError } from "../services/api";

// Debe coincidir con MAX_SCHEDULE_DAYS del backend.
const DIAS_MAXIMOS = 60;

// Duración de una consulta sin servicio asociado.
const DURACION_POR_DEFECTO = 30;

// Fecha de hoy en formato AAAA-MM-DD. Se usa UTC porque es como trabaja la API.
function hoyTexto() {
  return new Date().toISOString().slice(0, 10);
}

function fechaLimiteTexto() {
  const limite = new Date(Date.now() + DIAS_MAXIMOS * 24 * 60 * 60 * 1000);
  return limite.toISOString().slice(0, 10);
}

function AgendarCita() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [veterinario, setVeterinario] = useState(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);

  // Datos que elige el cliente
  const [servicioId, setServicioId] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");

  // Horarios libres del día elegido
  const [horarios, setHorarios] = useState([]);
  const [cargandoHorarios, setCargandoHorarios] = useState(false);

  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);
  const [enviando, setEnviando] = useState(false);

  // Carga del perfil del veterinario
  useEffect(() => {
    async function cargar() {
      try {
        const resultado = await obtenerVeterinario(id);
        setVeterinario(resultado);

        // Si el veterinario ofrece una sola modalidad, se elige sola.
        if (resultado.clinicService && !resultado.homeService) {
          setModalidad("CLINIC");
        } else if (resultado.homeService && !resultado.clinicService) {
          setModalidad("HOME");
        }
      } catch (error) {
        setErrores(obtenerMensajesDeError(error));
      } finally {
        setCargandoPerfil(false);
      }
    }

    cargar();
  }, [id]);

  const servicioElegido = useMemo(
    () => veterinario?.services.find((servicio) => String(servicio.id) === servicioId) || null,
    [veterinario, servicioId]
  );

  const duracion = servicioElegido ? servicioElegido.durationMinutes : DURACION_POR_DEFECTO;

  // AN-13: cada vez que cambia el día, la modalidad o el servicio, se vuelven
  // a pedir los horarios libres. La duración cambia qué bloques caben.
  useEffect(() => {
    if (!fecha || !modalidad) {
      return undefined;
    }

    let cancelado = false;

    async function cargar() {
      setCargandoHorarios(true);
      try {
        const resultado = await obtenerHorarios(id, {
          date: fecha,
          mode: modalidad,
          serviceId: servicioId || undefined,
        });
        if (!cancelado) {
          setHorarios(resultado.slots);
          setErrores([]);
        }
      } catch (error) {
        if (!cancelado) {
          setHorarios([]);
          setErrores(obtenerMensajesDeError(error));
        }
      } finally {
        if (!cancelado) {
          setCargandoHorarios(false);
        }
      }
    }

    cargar();

    return () => {
      cancelado = true;
    };
  }, [id, fecha, modalidad, servicioId]);

  // Los horarios cargados solo valen para la fecha y la modalidad elegidas:
  // si falta alguna, no se muestra ninguno en vez de dejar los del intento
  // anterior.
  const horariosVisibles = fecha && modalidad ? horarios : [];

  // Y la hora deja de estar elegida si ya no aparece entre los disponibles,
  // por ejemplo cuando otro cliente toma ese bloque.
  const horaElegida = horariosVisibles.includes(hora) ? hora : "";

  function validar() {
    const mensajes = [];

    if (!modalidad) {
      mensajes.push("Elige la modalidad de atención.");
    }
    if (!fecha) {
      mensajes.push("Elige la fecha de la cita.");
    }
    if (!horaElegida) {
      mensajes.push("Elige la hora de la cita.");
    }
    // AN-10: sin dirección no hay a dónde ir.
    if (modalidad === "HOME" && direccion.trim() === "") {
      mensajes.push("Indica la dirección donde se atenderá a tu mascota.");
    }

    return mensajes;
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();

    const mensajes = validar();
    if (mensajes.length > 0) {
      setExito([]);
      setErrores(mensajes);
      return;
    }

    setErrores([]);
    setEnviando(true);

    try {
      await agendarCita({
        vetProfileId: Number(id),
        serviceId: servicioId ? Number(servicioId) : null,
        mode: modalidad,
        date: fecha,
        time: horaElegida,
        address: modalidad === "HOME" ? direccion.trim() : null,
        notes: notas.trim(),
      });

      setExito([`Tu cita quedó agendada para el ${formatearFecha(fecha)} a las ${horaElegida}.`]);
      setTimeout(() => navigate("/citas"), 2000);
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));

      // Si el horario se ocupó mientras llenaba el formulario, se refresca
      // la lista para que pueda elegir otro sin recargar la página.
      setHora("");
      if (fecha && modalidad) {
        try {
          const resultado = await obtenerHorarios(id, {
            date: fecha,
            mode: modalidad,
            serviceId: servicioId || undefined,
          });
          setHorarios(resultado.slots);
        } catch {
          setHorarios([]);
        }
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pagina">
      <Cabecera />

      <main className="contenedor">
        <Link to={`/veterinarios/${id}`} className="enlace-volver">
          ← Volver al perfil
        </Link>

        {cargandoPerfil && <p className="texto-suave">Cargando...</p>}

        {veterinario && (
          <div className="tarjeta">
            <h1>Agendar cita</h1>
            <p className="texto-suave">
              Con {veterinario.name} · {veterinario.specialty}
            </p>

            <Alerta tipo="exito" mensajes={exito} />
            <Alerta tipo="error" mensajes={errores} />

            <form onSubmit={manejarEnvio} noValidate>
              {/* Paso 1: servicio */}
              <div className="campo">
                <label htmlFor="servicio">Servicio</label>
                <select
                  id="servicio"
                  value={servicioId}
                  onChange={(evento) => setServicioId(evento.target.value)}
                >
                  <option value="">Consulta general ({DURACION_POR_DEFECTO} min)</option>
                  {veterinario.services.map((servicio) => (
                    <option key={servicio.id} value={servicio.id}>
                      {servicio.name} ({servicio.durationMinutes} min)
                    </option>
                  ))}
                </select>
                <span className="ayuda">La duración del servicio define los horarios que caben.</span>
              </div>

              {/* Paso 2: modalidad de atención (AN-10 y AN-11) */}
              <fieldset className="selector-rol">
                <legend>
                  Modalidad de atención <span className="obligatorio">*</span>
                </legend>

                {veterinario.clinicService && (
                  <label className={`opcion-rol ${modalidad === "CLINIC" ? "activa" : ""}`}>
                    <input
                      type="radio"
                      name="modalidad"
                      value="CLINIC"
                      checked={modalidad === "CLINIC"}
                      onChange={() => setModalidad("CLINIC")}
                    />
                    <span className="opcion-rol-titulo">{MODALIDADES.CLINIC}</span>
                    <span className="opcion-rol-texto">
                      {veterinario.address || "Llevas a tu mascota al consultorio."}
                    </span>
                  </label>
                )}

                {veterinario.homeService && (
                  <label className={`opcion-rol ${modalidad === "HOME" ? "activa" : ""}`}>
                    <input
                      type="radio"
                      name="modalidad"
                      value="HOME"
                      checked={modalidad === "HOME"}
                      onChange={() => setModalidad("HOME")}
                    />
                    <span className="opcion-rol-titulo">{MODALIDADES.HOME}</span>
                    <span className="opcion-rol-texto">El veterinario va hasta tu casa.</span>
                  </label>
                )}
              </fieldset>

              {/* La dirección solo se pide en atención a domicilio (AN-10) */}
              {modalidad === "HOME" && (
                <div className="campo">
                  <label htmlFor="direccion">
                    Dirección de la visita <span className="obligatorio">*</span>
                  </label>
                  <input
                    id="direccion"
                    type="text"
                    value={direccion}
                    onChange={(evento) => setDireccion(evento.target.value)}
                    placeholder="Carrera 7 # 40-15, apto 302"
                  />
                </div>
              )}

              {/* Paso 3: fecha (AN-13) */}
              <div className="campo">
                <label htmlFor="fecha">
                  Fecha <span className="obligatorio">*</span>
                </label>
                <input
                  id="fecha"
                  type="date"
                  value={fecha}
                  min={hoyTexto()}
                  max={fechaLimiteTexto()}
                  onChange={(evento) => setFecha(evento.target.value)}
                />
                <span className="ayuda">Puedes agendar hasta {DIAS_MAXIMOS} días adelante.</span>
              </div>

              {/* Paso 4: hora, entre los bloques libres del veterinario (AN-13) */}
              <div className="campo">
                <label>
                  Hora <span className="obligatorio">*</span>
                </label>

                {!modalidad && <p className="texto-suave">Elige primero la modalidad de atención.</p>}

                {modalidad && !fecha && (
                  <p className="texto-suave">Elige una fecha para ver los horarios libres.</p>
                )}

                {cargandoHorarios && <p className="texto-suave">Buscando horarios...</p>}

                {modalidad && fecha && !cargandoHorarios && horariosVisibles.length === 0 && (
                  <p className="texto-suave">
                    No hay horarios libres ese día. Prueba con otra fecha.
                  </p>
                )}

                {!cargandoHorarios && horariosVisibles.length > 0 && (
                  <div className="horarios">
                    {horariosVisibles.map((bloque) => (
                      <button
                        type="button"
                        key={bloque}
                        className={`horario ${horaElegida === bloque ? "activo" : ""}`}
                        onClick={() => setHora(bloque)}
                      >
                        {bloque}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="campo">
                <label htmlFor="notas">Motivo de la consulta</label>
                <textarea
                  id="notas"
                  rows={3}
                  value={notas}
                  onChange={(evento) => setNotas(evento.target.value)}
                  placeholder="Cuéntale al veterinario qué le pasa a tu mascota."
                />
              </div>

              {/* Resumen de lo elegido antes de confirmar */}
              {fecha && horaElegida && modalidad && (
                <div className="resumen">
                  <strong>Resumen</strong>
                  <p>
                    {servicioElegido ? servicioElegido.name : "Consulta general"} · {duracion} min ·{" "}
                    {MODALIDADES[modalidad]}
                  </p>
                  <p className="texto-suave">
                    {formatearFecha(fecha)} a las {horaElegida}
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="boton boton-primario boton-enviar"
                disabled={enviando || exito.length > 0}
              >
                {enviando ? "Agendando..." : "Confirmar cita"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default AgendarCita;
