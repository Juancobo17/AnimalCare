// Agendamiento de una cita, paso a paso.
//
// Reune tres historias del sprint:
// AN-10 elegir atención a domicilio
// AN-11 elegir atención en la veterinaria
// AN-13 escoger fecha y hora entre los horarios libres del veterinario
//
// El formulario se divide en cuatro pasos (servicio, lugar, fecha y hora,
// confirmar). La logica de horarios y el envio a la API no cambian: solo se
// decide que campos se muestran en cada paso.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Selector from "../components/Selector";
import { usarTitulo } from "../hooks/usarTitulo";
import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import FotoVeterinario from "../components/FotoVeterinario";
import Icono from "../components/Icono";
import {
  obtenerVeterinario,
  obtenerHorarios,
  obtenerDiasDisponibles,
  formatearPrecio,
  MODALIDADES,
} from "../services/vet.service";
import { agendarCita, formatearFecha, HORAS_MINIMAS_CANCELACION } from "../services/appointment.service";
import { hoyLocal, sumarDias } from "../services/zona";
import { listarMascotas } from "../services/pet.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

// "jue", "19", "nov" para los botones de día.
function partesDelDia(fecha) {
  const valor = new Date(`${fecha}T12:00:00Z`);
  const opciones = { timeZone: "UTC" };
  return {
    semana: valor.toLocaleDateString("es-CO", { ...opciones, weekday: "short" }).replace(".", ""),
    dia: valor.getUTCDate(),
    mes: valor.toLocaleDateString("es-CO", { ...opciones, month: "short" }).replace(".", ""),
  };
}

// Debe coincidir con MAX_SCHEDULE_DAYS del backend.
const DIAS_MAXIMOS = 60;

// Duración de una consulta sin servicio asociado.
const DURACION_POR_DEFECTO = 30;

// Pasos del agendamiento. El ultimo es la revision antes de confirmar.
const PASOS = [
  { titulo: "Servicio", detalle: "¿Quién va y a qué?" },
  { titulo: "Lugar", detalle: "¿Dónde será la atención?" },
  { titulo: "Fecha y hora", detalle: "Elige un turno libre" },
  { titulo: "Confirmar", detalle: "Revisa y confirma tu cita" },
];

// Fechas en la zona horaria de la clinica, igual que la API.
function hoyTexto() {
  return hoyLocal();
}

function fechaLimiteTexto() {
  return sumarDias(hoyLocal(), DIAS_MAXIMOS);
}

function AgendarCita() {
  usarTitulo("Agendar cita");
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
  const [mascotaId, setMascotaId] = useState("");

  // Mascotas del cliente (null mientras cargan)
  const [mascotas, setMascotas] = useState(null);
  // Proximos 14 dias con su cantidad de turnos libres
  const [dias, setDias] = useState([]);
  const [otraFecha, setOtraFecha] = useState(false);

  // Horarios libres del día elegido
  const [horarios, setHorarios] = useState([]);
  const [cargandoHorarios, setCargandoHorarios] = useState(false);

  const [errores, setErrores] = useState([]);
  const [sinConexion, setSinConexion] = useState(false);
  const [intento, setIntento] = useState(0);
  const [exito, setExito] = useState([]);
  const [enviando, setEnviando] = useState(false);

  // Paso actual (1 a 4). Al cambiar, el foco pasa al titulo del paso para que
  // quien usa teclado o lector de pantalla note que cambio la pantalla.
  const [paso, setPaso] = useState(1);
  const tituloPasoRef = useRef(null);
  const yaMontado = useRef(false);
  useEffect(() => {
    if (!yaMontado.current) {
      yaMontado.current = true;
      return;
    }
    tituloPasoRef.current?.focus();
  }, [paso]);

  // Carga del perfil del veterinario
  useEffect(() => {
    async function cargar() {
      setCargandoPerfil(true);
      try {
        const resultado = await obtenerVeterinario(id);
        setErrores([]);
        setSinConexion(false);
        setVeterinario(resultado);

        // Si el veterinario ofrece una sola modalidad, se elige sola.
        if (resultado.clinicService && !resultado.homeService) {
          setModalidad("CLINIC");
        } else if (resultado.homeService && !resultado.clinicService) {
          setModalidad("HOME");
        }
      } catch (error) {
        setErrores(obtenerMensajesDeError(error));
        setSinConexion(esErrorDeConexion(error));
      } finally {
        setCargandoPerfil(false);
      }
    }

    cargar();
  }, [id, intento]);

  // Mascotas del cliente: si tiene una sola, queda elegida.
  useEffect(() => {
    listarMascotas()
      .then((datos) => {
        setMascotas(datos.pets);
        if (datos.pets.length === 1) setMascotaId(String(datos.pets[0].id));
      })
      .catch(() => setMascotas([]));
  }, []);

  // Dias con turnos libres para la modalidad y el servicio elegidos.
  useEffect(() => {
    if (!modalidad) return undefined;
    let cancelado = false;
    obtenerDiasDisponibles(id, { mode: modalidad, serviceId: servicioId || undefined })
      .then((resultado) => {
        if (!cancelado) setDias(resultado);
      })
      .catch(() => {
        if (!cancelado) setDias([]);
      });
    return () => {
      cancelado = true;
    };
  }, [id, modalidad, servicioId, intento]);

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
          setSinConexion(esErrorDeConexion(error));
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
  }, [id, fecha, modalidad, servicioId, intento]);

  // Los horarios cargados solo valen para la fecha y la modalidad elegidas:
  // si falta alguna, no se muestra ninguno en vez de dejar los del intento
  // anterior.
  const horariosVisibles = fecha && modalidad ? horarios : [];

  // Y la hora deja de estar elegida si ya no aparece entre los disponibles,
  // por ejemplo cuando otro cliente toma ese bloque.
  const horaElegida = horariosVisibles.includes(hora) ? hora : "";

  function validar() {
    const mensajes = [];

    if (mascotas && mascotas.length > 0 && !mascotaId) {
      mensajes.push("Elige la mascota que vas a llevar.");
    }
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

  // Valida solo los campos del paso indicado, con los mismos mensajes del envio.
  function validarPaso(numero) {
    const mensajes = [];

    if (numero === 1 && mascotas && mascotas.length > 0 && !mascotaId) {
      mensajes.push("Elige la mascota que vas a llevar.");
    }
    if (numero === 2) {
      if (!modalidad) mensajes.push("Elige la modalidad de atención.");
      // AN-10: sin dirección no hay a dónde ir.
      if (modalidad === "HOME" && direccion.trim() === "") {
        mensajes.push("Indica la dirección donde se atenderá a tu mascota.");
      }
    }
    if (numero === 3) {
      if (!fecha) mensajes.push("Elige la fecha de la cita.");
      if (fecha && !horaElegida) mensajes.push("Elige la hora de la cita.");
    }

    return mensajes;
  }

  function continuar() {
    const mensajes = validarPaso(paso);
    if (mensajes.length > 0) {
      setExito([]);
      setSinConexion(false);
      setErrores(mensajes);
      return;
    }
    setErrores([]);
    setPaso((actual) => Math.min(actual + 1, PASOS.length));
  }

  function volver() {
    setErrores([]);
    setPaso((actual) => Math.max(actual - 1, 1));
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();

    // Con Enter en un paso intermedio se avanza en vez de enviar.
    if (paso < PASOS.length) {
      continuar();
      return;
    }

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
        petId: mascotaId ? Number(mascotaId) : null,
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

      // Si el horario se ocupó mientras llenaba el formulario, se vuelve al paso
      // de fecha y hora y se refresca la lista para que elija otro sin recargar.
      setHora("");
      setPaso(3);
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

  const mascotaElegida = mascotas ? mascotas.find((m) => String(m.id) === mascotaId) : null;
  const nombreServicio = servicioElegido ? servicioElegido.name : "Consulta general";
  const textoValor = servicioElegido ? formatearPrecio(servicioElegido.price) : "Lo acuerdas en la consulta";
  const bloqueado = enviando || exito.length > 0;

  return (
    <div className="pagina">
      <Cabecera />

      <main className="contenedor contenedor-medio">
        <Link to={`/veterinarios/${id}`} className="enlace-volver">
          ← Volver al perfil
        </Link>

        {cargandoPerfil && <p className="texto-suave">Cargando...</p>}

        {veterinario && (
          <div className="agendar">
            <div className="tarjeta agendar-principal">
              <h1>Agendar cita</h1>
              <p className="texto-suave">
                Con {veterinario.name} · {veterinario.specialty}
              </p>

              {/* Indicador de progreso: los pasos ya completados permiten volver. */}
              <ol className="pasos" aria-label="Progreso">
                {PASOS.map((p, indice) => {
                  const numero = indice + 1;
                  const estado = numero < paso ? "completado" : numero === paso ? "actual" : "pendiente";
                  return (
                    <li
                      key={p.titulo}
                      className={`paso paso-${estado}`}
                      aria-current={numero === paso ? "step" : undefined}
                    >
                      {numero < paso && !bloqueado ? (
                        <button
                          type="button"
                          className="paso-marca"
                          onClick={() => setPaso(numero)}
                          aria-label={`Volver al paso ${numero}: ${p.titulo}`}
                        >
                          <Icono nombre="check" tamano={16} grosor={2.6} />
                        </button>
                      ) : (
                        <span className="paso-marca">
                          {numero < paso ? <Icono nombre="check" tamano={16} grosor={2.6} /> : numero}
                        </span>
                      )}
                      <span className="paso-nombre">{p.titulo}</span>
                    </li>
                  );
                })}
              </ol>

              <Alerta tipo="exito" mensajes={exito} />
              <Alerta
                tipo="error"
                mensajes={errores}
                onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined}
              />

              <form onSubmit={manejarEnvio} noValidate>
                <h2 className="paso-titulo" ref={tituloPasoRef} tabIndex={-1}>
                  <span className="paso-contador">
                    Paso {paso} de {PASOS.length}
                  </span>
                  {PASOS[paso - 1].detalle}
                </h2>

                {/* Paso 1: mascota y servicio */}
                {paso === 1 && (
                  <>
                    {mascotas && mascotas.length > 0 && (
                      <div className="campo">
                        <label htmlFor="mascota">
                          Mascota <span className="obligatorio">*</span>
                        </label>
                        <Selector id="mascota" value={mascotaId} onChange={(e) => setMascotaId(e.target.value)}>
                          <option value="">Elige a quién llevas</option>
                          {mascotas.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.species})
                            </option>
                          ))}
                        </Selector>
                      </div>
                    )}
                    {mascotas && mascotas.length === 0 && (
                      <p className="aviso-suave">
                        ¿Aún no registras a tu mascota? <Link to="/mascotas?nueva=1">Regístrala aquí</Link> para que
                        el veterinario conozca su especie, edad y peso. También puedes agendar sin hacerlo.
                      </p>
                    )}

                    <div className="campo">
                      <label htmlFor="servicio">Servicio</label>
                      <Selector
                        id="servicio"
                        value={servicioId}
                        onChange={(evento) => setServicioId(evento.target.value)}
                      >
                        <option value="">Consulta general ({DURACION_POR_DEFECTO} min)</option>
                        {veterinario.services.map((servicio) => (
                          <option key={servicio.id} value={servicio.id}>
                            {servicio.name} · {servicio.durationMinutes} min · {formatearPrecio(servicio.price)}
                          </option>
                        ))}
                      </Selector>
                      <span className="ayuda">La duración del servicio define los horarios que caben.</span>
                    </div>
                  </>
                )}

                {/* Paso 2: modalidad de atención (AN-10 y AN-11) */}
                {paso === 2 && (
                  <>
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
                  </>
                )}

                {/* Paso 3: fecha y hora (AN-13) */}
                {paso === 3 && (
                  <>
                    <div className="campo">
                      <label htmlFor="fecha">
                        Fecha <span className="obligatorio">*</span>
                      </label>

                      {/* Proximos 14 dias: solo se pueden elegir los que tienen turnos */}
                      {dias.length > 0 && (
                        <div className="dias" role="group" aria-label="Próximos días">
                          {dias.map((d) => {
                            const p = partesDelDia(d.date);
                            return (
                              <button
                                key={d.date}
                                type="button"
                                className={`dia-opcion ${fecha === d.date ? "activo" : ""}`}
                                disabled={d.available === 0}
                                aria-pressed={fecha === d.date}
                                aria-label={`${formatearFecha(d.date)}: ${d.available} turnos libres`}
                                onClick={() => {
                                  setOtraFecha(false);
                                  setFecha(d.date);
                                }}
                              >
                                <span className="dia-semana">{p.semana}</span>
                                <span className="dia-numero">{p.dia}</span>
                                <span className="dia-mes">{p.mes}</span>
                                <span className="dia-turnos">{d.available === 0 ? "—" : `${d.available} libres`}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <button type="button" className="enlace-accion" onClick={() => setOtraFecha((v) => !v)}>
                        {otraFecha ? "Ocultar calendario" : "Buscar otra fecha (hasta 60 días)"}
                      </button>
                      {otraFecha && (
                        <input
                          id="fecha"
                          type="date"
                          value={fecha}
                          min={hoyTexto()}
                          max={fechaLimiteTexto()}
                          onChange={(evento) => setFecha(evento.target.value)}
                        />
                      )}
                      <span className="ayuda">Puedes agendar hasta {DIAS_MAXIMOS} días adelante.</span>
                    </div>

                    <div className="campo">
                      <label>
                        Hora <span className="obligatorio">*</span>
                      </label>

                      {!fecha && <p className="texto-suave">Elige una fecha para ver los horarios libres.</p>}

                      {cargandoHorarios && <p className="texto-suave">Buscando horarios...</p>}

                      {fecha && !cargandoHorarios && horariosVisibles.length === 0 && (
                        <p className="texto-suave">No hay horarios libres ese día. Prueba con otra fecha.</p>
                      )}

                      {!cargandoHorarios && horariosVisibles.length > 0 && (
                        <div className="horarios">
                          {horariosVisibles.map((bloque) => (
                            <button
                              type="button"
                              key={bloque}
                              className={`horario ${horaElegida === bloque ? "activo" : ""}`}
                              aria-pressed={horaElegida === bloque}
                              onClick={() => setHora(bloque)}
                            >
                              {bloque}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Paso 4: motivo y revision final */}
                {paso === 4 && (
                  <>
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

                    <div className="resumen">
                      <strong>Resumen de tu cita</strong>
                      <p>
                        {nombreServicio} · {duracion} min · {MODALIDADES[modalidad]}
                      </p>
                      <p>Valor: {textoValor}</p>
                      <p className="texto-suave">
                        {formatearFecha(fecha)} a las {horaElegida}
                      </p>
                      {mascotaElegida && <p className="texto-suave">Mascota: {mascotaElegida.name}</p>}
                      {modalidad === "HOME" && <p className="texto-suave">Dirección: {direccion.trim()}</p>}
                    </div>

                    <p className="ayuda politica">
                      Política de cancelación: puedes cancelar sin costo hasta {HORAS_MINIMAS_CANCELACION} horas
                      antes de la cita desde "Mis citas". Después, comunícate con el veterinario.
                    </p>
                  </>
                )}

                <div className="paso-acciones">
                  {paso > 1 && (
                    <button
                      type="button"
                      className="boton boton-secundario boton-auto"
                      onClick={volver}
                      disabled={bloqueado}
                    >
                      Atrás
                    </button>
                  )}
                  {paso < PASOS.length ? (
                    <button key="continuar" type="button" className="boton boton-primario boton-auto" onClick={continuar}>
                      Continuar
                    </button>
                  ) : (
                    // Es un boton normal (type="button") y confirma por clic, NO un "submit":
                    // asi ningun clic anterior (el de "Continuar" que llega a este paso) puede
                    // enviar el formulario por accidente cuando React reutiliza el mismo boton.
                    <button
                      key="confirmar"
                      type="button"
                      className="boton boton-primario boton-auto"
                      disabled={bloqueado}
                      onClick={manejarEnvio}
                    >
                      {enviando ? "Agendando..." : "Confirmar cita"}
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Resumen que se va llenando a medida que se avanza (solo en pantallas anchas) */}
            <aside className="tarjeta agendar-resumen" aria-label="Resumen de la cita">
              <div className="agendar-vet">
                <FotoVeterinario nombre={veterinario.name} url={veterinario.photoUrl} tamano={56} />
                <div>
                  <strong>{veterinario.name}</strong>
                  <span className="texto-suave">{veterinario.specialty}</span>
                </div>
              </div>

              <dl className="agendar-datos">
                <div>
                  <dt>Servicio</dt>
                  <dd>
                    {nombreServicio} · {duracion} min
                  </dd>
                </div>
                <div>
                  <dt>Mascota</dt>
                  <dd className={mascotaElegida ? "" : "pendiente"}>
                    {mascotaElegida ? mascotaElegida.name : "Sin elegir"}
                  </dd>
                </div>
                <div>
                  <dt>Lugar</dt>
                  <dd className={modalidad ? "" : "pendiente"}>{modalidad ? MODALIDADES[modalidad] : "Sin elegir"}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd className={fecha ? "" : "pendiente"}>{fecha ? formatearFecha(fecha) : "Sin elegir"}</dd>
                </div>
                <div>
                  <dt>Hora</dt>
                  <dd className={horaElegida ? "" : "pendiente"}>{horaElegida || "Sin elegir"}</dd>
                </div>
              </dl>

              <div className="agendar-total">
                <span>Valor</span>
                <strong>{textoValor}</strong>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

export default AgendarCita;
