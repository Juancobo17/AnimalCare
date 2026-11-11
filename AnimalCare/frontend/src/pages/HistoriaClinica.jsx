// Historia clínica de una mascota.
// Dueño (AN-21): consulta de solo lectura, en /mascotas/:id/historia.
// Veterinario: crear (AN-18), modificar (AN-20) y eliminar (AN-19) sus
// entradas, en /pacientes/:id. ?cita=ID abre el formulario ligado a esa cita.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import Selector from "../components/Selector";
import { usarTitulo } from "../hooks/usarTitulo";
import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import Adjuntos from "../components/Adjuntos";
import Icono from "../components/Icono";
import { obtenerUsuario } from "../services/auth.service";
import { obtenerHistoria, crearEntrada, modificarEntrada, eliminarEntrada } from "../services/medicalRecord.service";
import IconoEspecie from "../components/IconoEspecie";
import { calcularEdad } from "../services/pet.service";
import { formatearFecha, hoyLocal, completarCita } from "../services/appointment.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

const VACIA = {
  appointmentId: "",
  visitDate: "",
  reason: "",
  diagnosis: "",
  treatment: "",
  weight: "",
  temperature: "",
  vaccines: "",
  observations: "",
};

// atencion: si se pasa, el formulario es el de una atencion en curso ({ recordId }) y termina con
// "Guardar avance", "Guardar y terminar atencion" o "Terminar sin registrar".
function FormularioEntrada({ inicial, citasPendientes = [], textoBoton, onGuardar, onCancelar, atencion = null }) {
  const [confirmandoSin, setConfirmandoSin] = useState(false);
  const [datos, setDatos] = useState(inicial);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);

  function cambiar(e) {
    const { name, value } = e.target;
    const limpio = name === "weight" || name === "temperature" ? value.replace(/[^0-9.]/g, "") : value;
    setDatos((a) => {
      const nuevo = { ...a, [name]: limpio };
      // Al elegir una cita, la fecha y el motivo se completan con sus datos.
      if (name === "appointmentId") {
        const cita = citasPendientes.find((c) => String(c.id) === value);
        if (cita) {
          nuevo.visitDate = cita.date;
          if (!a.reason) nuevo.reason = cita.notes || cita.service;
        }
      }
      return nuevo;
    });
  }

  async function omitir() {
    setErrores([]);
    setGuardando(true);
    try {
      await onGuardar(null, "sin_registrar");
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
      setGuardando(false);
    }
  }

  async function enviar(e, accion = "avance") {
    e?.preventDefault?.();
    const mensajes = [];
    if (citasPendientes.length > 0 && !datos.appointmentId) mensajes.push("Elige la cita a la que pertenece la entrada.");
    if (datos.reason.trim() === "") mensajes.push("El motivo de consulta es obligatorio.");
    if (datos.diagnosis.trim() === "") mensajes.push("El diagnóstico es obligatorio.");
    if (mensajes.length > 0) {
      setErrores(mensajes);
      return;
    }
    setErrores([]);
    setGuardando(true);
    try {
      await onGuardar(datos, accion);
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="formulario-historia">
      <Alerta tipo="error" mensajes={errores} />

      {citasPendientes.length > 0 && (
        <div className="campo">
          <label htmlFor="cita">
            Cita <span className="obligatorio">*</span>
          </label>
          <Selector id="cita" name="appointmentId" value={datos.appointmentId} onChange={cambiar}>
            <option value="">Elige la cita que estás atendiendo</option>
            {citasPendientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.when} · {c.service}
              </option>
            ))}
          </Selector>
        </div>
      )}

      <div className="fila">
        <div className="campo">
          <label htmlFor="reason">
            Motivo de consulta <span className="obligatorio">*</span>
          </label>
          <input id="reason" name="reason" maxLength={200} value={datos.reason} onChange={cambiar} />
        </div>
        <div className="campo">
          <label htmlFor="visitDate">Fecha de la consulta</label>
          <input id="visitDate" type="date" name="visitDate" max={hoyLocal()} value={datos.visitDate} onChange={cambiar} />
          <span className="ayuda">Si la dejas vacía se usa la fecha de la cita o la de hoy.</span>
        </div>
      </div>

      <div className="campo">
        <label htmlFor="diagnosis">
          Diagnóstico <span className="obligatorio">*</span>
        </label>
        <textarea id="diagnosis" name="diagnosis" rows={3} maxLength={2000} value={datos.diagnosis} onChange={cambiar} />
      </div>
      <div className="campo">
        <label htmlFor="treatment">Tratamiento</label>
        <textarea id="treatment" name="treatment" rows={2} maxLength={2000} value={datos.treatment} onChange={cambiar} />
      </div>

      <div className="fila fila-tres">
        <div className="campo">
          <label htmlFor="weight">Peso (kg)</label>
          <input id="weight" name="weight" inputMode="decimal" value={datos.weight} onChange={cambiar} placeholder="4.5" />
        </div>
        <div className="campo">
          <label htmlFor="temperature">Temperatura (°C)</label>
          <input id="temperature" name="temperature" inputMode="decimal" value={datos.temperature} onChange={cambiar} placeholder="38.5" />
        </div>
        <div className="campo">
          <label htmlFor="vaccines">Vacunas aplicadas</label>
          <input id="vaccines" name="vaccines" maxLength={2000} value={datos.vaccines} onChange={cambiar} placeholder="Rabia, triple felina..." />
        </div>
      </div>

      <div className="campo">
        <label htmlFor="observations">Observaciones</label>
        <textarea id="observations" name="observations" rows={2} maxLength={2000} value={datos.observations} onChange={cambiar} />
      </div>

      {atencion ? (
        <div className="acciones-linea">
          <button type="submit" className="boton boton-secundario boton-auto" disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar avance"}
          </button>
          <button
            type="button"
            className="boton boton-primario boton-auto"
            disabled={guardando}
            onClick={() => enviar(null, "terminar")}
          >
            Guardar y terminar atención
          </button>
          {!atencion.recordId &&
            (confirmandoSin ? (
              <span className="acciones-linea" role="alertdialog">
                <strong>
                  {atencion.emergency
                    ? "¿No realizaste la urgencia? Volverá a quedar disponible para otros veterinarios."
                    : "¿Terminar sin registrar la consulta?"}
                </strong>
                <button type="button" className="boton boton-peligro boton-auto" disabled={guardando} onClick={omitir}>
                  Sí, terminar sin registrar
                </button>
                <button type="button" className="boton boton-secundario boton-auto" onClick={() => setConfirmandoSin(false)}>
                  No
                </button>
              </span>
            ) : (
              <button type="button" className="boton boton-peligro boton-auto" disabled={guardando} onClick={() => setConfirmandoSin(true)}>
                Terminar sin registrar
              </button>
            ))}
        </div>
      ) : (
        <div className="acciones-linea">
          <button type="submit" className="boton boton-primario boton-auto" disabled={guardando}>
            {guardando ? "Guardando..." : textoBoton}
          </button>
          <button type="button" className="boton boton-secundario boton-auto" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
        </div>
      )}
    </form>
  );
}

function Entrada({ entrada, esVeterinario, onEditar, onEliminar, onCambio }) {
  const [eliminando, setEliminando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");

  if (entrada.status === "ANNULLED") {
    return (
      <li className="entrada entrada-anulada">
        <div className="entrada-cabecera">
          <strong className="entrada-fecha">
            <Icono nombre="calendario" tamano={15} grosor={2} />
            {formatearFecha(entrada.visitDate)}
          </strong>
          <span className="etiqueta etiqueta-cancelled">Eliminada</span>
        </div>
        <p className="texto-suave">
          {entrada.reason} · {entrada.vet.name}. Motivo de eliminación: {entrada.annulReason}
        </p>
      </li>
    );
  }

  async function confirmarEliminar() {
    if (motivo.trim() === "") {
      setError("Indica el motivo para eliminar la entrada.");
      return;
    }
    try {
      await onEliminar(entrada.id, motivo.trim());
    } catch (e) {
      setError(obtenerMensajesDeError(e).join(" "));
    }
  }

  return (
    <li className="entrada">
      <div className="entrada-cabecera">
        <strong className="entrada-fecha">
          <Icono nombre="calendario" tamano={15} grosor={2} />
          {formatearFecha(entrada.visitDate)}
        </strong>
        <span className="texto-suave">
          {entrada.vet.name}
          {entrada.vet.specialty ? ` · ${entrada.vet.specialty}` : ""}
          {entrada.edited ? " · editada" : ""}
        </span>
      </div>
      <h4>{entrada.reason}</h4>
      <dl className="entrada-datos">
        <div className="entrada-dato-ancho">
          <dt>Diagnóstico</dt>
          <dd>{entrada.diagnosis}</dd>
        </div>
        {entrada.treatment && (
          <div className="entrada-dato-ancho">
            <dt>Tratamiento</dt>
            <dd>{entrada.treatment}</dd>
          </div>
        )}
        {(entrada.weight !== null || entrada.temperature !== null) && (
          <div>
            <dt>Signos</dt>
            <dd>
              {[entrada.weight !== null && `${entrada.weight} kg`, entrada.temperature !== null && `${entrada.temperature} °C`]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          </div>
        )}
        {entrada.vaccines && (
          <div>
            <dt>Vacunas</dt>
            <dd>{entrada.vaccines}</dd>
          </div>
        )}
        {entrada.observations && (
          <div className="entrada-dato-ancho">
            <dt>Observaciones</dt>
            <dd>{entrada.observations}</dd>
          </div>
        )}
      </dl>

      <Adjuntos entrada={entrada} esVeterinario={esVeterinario} onCambio={onCambio} />

      {esVeterinario && entrada.canEdit && !eliminando && (
        <div className="acciones-linea no-imprimir">
          <button type="button" className="boton boton-secundario boton-auto" onClick={() => onEditar(entrada)}>
            <Icono nombre="editar" tamano={16} />
            Modificar
          </button>
          <button type="button" className="boton boton-peligro boton-auto" onClick={() => setEliminando(true)}>
            <Icono nombre="papelera" tamano={16} />
            Eliminar
          </button>
        </div>
      )}

      {eliminando && (
        <div className="cita-panel" role="alertdialog" aria-label="Eliminar entrada">
          <strong>¿Eliminar esta entrada?</strong>
          <p className="texto-suave">
            El dueño dejará de verla. Se conserva anulada, con el motivo, para auditoría.
          </p>
          <div className="campo">
            <label htmlFor={`motivo-${entrada.id}`}>
              Motivo <span className="obligatorio">*</span>
            </label>
            <input id={`motivo-${entrada.id}`} maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          {error && <p className="error-campo">{error}</p>}
          <div className="acciones-linea">
            <button type="button" className="boton boton-peligro boton-auto" onClick={confirmarEliminar}>
              Sí, eliminar
            </button>
            <button type="button" className="boton boton-secundario boton-auto" onClick={() => setEliminando(false)}>
              No
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function HistoriaClinica() {
  usarTitulo("Historia clínica");
  const { id } = useParams();
  const [parametros] = useSearchParams();
  const navigate = useNavigate();
  const esVeterinario = obtenerUsuario()?.role === "VETERINARIAN";

  const [historia, setHistoria] = useState(null);
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);
  const [sinConexion, setSinConexion] = useState(false);
  const [intento, setIntento] = useState(0);
  // null | "nueva" | entrada que se esta editando
  const [formulario, setFormulario] = useState(null);
  const [mostrarAnuladas, setMostrarAnuladas] = useState(false);

  async function cargar() {
    const crudos = await obtenerHistoria(id);
    // Las atenciones en curso se llenan en su propia tarjeta; aqui quedan las ya atendidas sin registrar.
    const datos = { ...crudos, pendingAppointments: crudos.pendingAppointments?.filter((c) => c.status === "COMPLETED") };
    setHistoria(datos);
    return datos;
  }

  useEffect(() => {
    cargar()
      .then((datos) => {
        setErrores([]);
        setSinConexion(false);
        // ?cita=ID llega desde la agenda: abre el formulario con esa cita elegida.
        const cita = parametros.get("cita");
        if (esVeterinario && cita && datos.pendingAppointments?.some((c) => String(c.id) === cita)) {
          setFormulario("nueva");
        }
      })
      .catch((error) => {
        setErrores(obtenerMensajesDeError(error));
        setSinConexion(esErrorDeConexion(error));
      });
  }, [id, intento]);

  async function guardarNueva(datos) {
    const r = await crearEntrada({ ...datos, petId: Number(id), appointmentId: datos.appointmentId || null });
    await cargar();
    setFormulario(null);
    setExito([r.message]);
  }

  // Atencion en curso: guardar avance (se sigue editando) o guardar y terminar (cierra la cita).
  async function guardarAtencion(atencion, datos, accion) {
    if (accion === "sin_registrar") {
      await completarCita(atencion.id, { skipRecord: true });
      // Una urgencia que no se realizo vuelve a quedar disponible: se regresa a Urgencias.
      navigate(atencion.emergency ? "/urgencias" : "/citas");
      return;
    }
    if (atencion.recordId) await modificarEntrada(atencion.recordId, datos);
    else await crearEntrada({ ...datos, petId: Number(id), appointmentId: atencion.id });
    if (accion === "terminar") {
      await completarCita(atencion.id);
      navigate("/citas");
      return;
    }
    await cargar();
    setExito(["Avance guardado. Puedes seguir editando hasta terminar la atención."]);
  }

  async function guardarEdicion(entradaId, datos) {
    const r = await modificarEntrada(entradaId, datos);
    await cargar();
    setFormulario(null);
    setExito([r.message]);
  }

  async function eliminar(entradaId, motivo) {
    const r = await eliminarEntrada(entradaId, motivo);
    await cargar();
    setExito([r.message]);
  }

  const pet = historia?.pet;
  const vigentes = historia ? historia.records.filter((r) => r.status !== "ANNULLED") : [];
  const anuladas = historia ? historia.records.filter((r) => r.status === "ANNULLED") : [];
  const citaInicial = parametros.get("cita");
  const citaElegida = historia?.pendingAppointments?.find((c) => String(c.id) === citaInicial);
  const enCurso = historia?.inProgressAppointments || [];
  const atencion = esVeterinario ? enCurso.find((c) => String(c.id) === citaInicial) || enCurso[0] : undefined;
  const registroAtencion = atencion?.recordId ? historia.records.find((r) => r.id === atencion.recordId) : null;

  return (
    <div className="pagina">
      <Cabecera />
      <main className="contenedor contenedor-medio">
        <Link to={esVeterinario ? "/citas" : "/mascotas"} className="enlace-volver no-imprimir">
          ← {esVeterinario ? "Volver a mi agenda" : "Volver a mis mascotas"}
        </Link>

        <Alerta tipo="exito" mensajes={exito} />
        <Alerta tipo="error" mensajes={errores} onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined} />

        {!historia && errores.length === 0 && (
          <div className="tarjeta" aria-busy="true" aria-label="Cargando historia clínica">
            <div className="esqueleto" style={{ height: 28, width: "55%", marginBottom: 12 }} />
            <div className="esqueleto" style={{ height: 16, width: "35%", marginBottom: 24 }} />
            <div className="esqueleto" style={{ height: 110 }} />
          </div>
        )}

        {pet && (
          <>
            <div className="tarjeta">
              <div className="encabezado-seccion">
                <div className="mascota historia-mascota">
                  <div className="mascota-icono" aria-hidden="true">
                    <IconoEspecie especie={pet.species} tamano={30} />
                  </div>
                  <div className="mascota-datos">
                    <h1>Historia clínica de {pet.name}</h1>
                    <ul className="mascota-chips" aria-label={`Datos de ${pet.name}`}>
                      <li>{pet.species}</li>
                      <li>{pet.sex}</li>
                      <li>{calcularEdad(pet.birthDate)}</li>
                      {pet.weight !== null && <li>{pet.weight} kg</li>}
                    </ul>
                    {pet.owner && <p className="texto-suave historia-dueno">Dueño: {pet.owner.name}</p>}
                  </div>
                </div>
                <div className="acciones-linea no-imprimir">
                  {esVeterinario && formulario === null && historia.pendingAppointments?.length > 0 && (
                    <button type="button" className="boton boton-primario boton-auto" onClick={() => setFormulario("nueva")}>
                      <Icono nombre="mas" tamano={18} grosor={2.4} />
                      Registrar consulta
                    </button>
                  )}
                  {!esVeterinario && vigentes.length > 0 && (
                    <button type="button" className="boton boton-secundario boton-auto" onClick={() => window.print()}>
                      <Icono nombre="imprimir" tamano={18} />
                      Imprimir
                    </button>
                  )}
                </div>
              </div>
              {esVeterinario && historia.pendingAppointments?.length > 0 && formulario === null && (
                <p className="aviso-suave dato-icono">
                  <Icono nombre="documento" tamano={18} />
                  Tienes {historia.pendingAppointments.length} consulta(s) con {pet.name} sin registrar en la historia.
                </p>
              )}
              {esVeterinario && historia.pendingAppointments?.length === 0 && !atencion && (
                <p className="aviso-suave dato-icono">
                  <Icono nombre="documento" tamano={18} />
                  Cada entrada se registra desde una cita: podrás hacerlo en cuanto empiece la próxima consulta con{" "}
                  {pet.name}.
                </p>
              )}
            </div>

            {atencion && (
              <div className="tarjeta">
                <h3>Atención en curso · {atencion.service}</h3>
                <p className="texto-suave">
                  Llena la historia de {pet.name} mientras la atiendes. "Guardar avance" no cierra la cita; "Guardar y
                  terminar atención" la termina y avisa al dueño.
                </p>
                <FormularioEntrada
                  key={`${atencion.id}-${atencion.recordId || "nueva"}`}
                  atencion={atencion}
                  inicial={
                    registroAtencion
                      ? {
                          ...VACIA,
                          appointmentId: String(atencion.id),
                          visitDate: registroAtencion.visitDate,
                          reason: registroAtencion.reason,
                          diagnosis: registroAtencion.diagnosis,
                          treatment: registroAtencion.treatment || "",
                          weight: registroAtencion.weight !== null ? String(registroAtencion.weight) : "",
                          temperature: registroAtencion.temperature !== null ? String(registroAtencion.temperature) : "",
                          vaccines: registroAtencion.vaccines || "",
                          observations: registroAtencion.observations || "",
                        }
                      : {
                          ...VACIA,
                          appointmentId: String(atencion.id),
                          reason: (atencion.notes || atencion.service || "").slice(0, 200),
                          weight: pet.weight !== null ? String(pet.weight) : "",
                        }
                  }
                  onGuardar={(datos, accion) => guardarAtencion(atencion, datos, accion)}
                  onCancelar={() => {}}
                />
              </div>
            )}

            {esVeterinario && formulario === "nueva" && (
              <div className="tarjeta">
                <h3>Registrar consulta</h3>
                <FormularioEntrada
                  inicial={{
                    ...VACIA,
                    appointmentId: citaElegida ? String(citaElegida.id) : "",
                    visitDate: citaElegida ? citaElegida.date : "",
                    reason: citaElegida ? citaElegida.notes || citaElegida.service : "",
                    weight: pet.weight !== null ? String(pet.weight) : "",
                  }}
                  citasPendientes={historia.pendingAppointments}
                  textoBoton="Guardar en la historia"
                  onGuardar={guardarNueva}
                  onCancelar={() => setFormulario(null)}
                />
              </div>
            )}

            {esVeterinario && formulario && formulario !== "nueva" && (
              <div className="tarjeta">
                <h3>Modificar entrada del {formatearFecha(formulario.visitDate)}</h3>
                <FormularioEntrada
                  inicial={{
                    ...VACIA,
                    visitDate: formulario.visitDate,
                    reason: formulario.reason,
                    diagnosis: formulario.diagnosis,
                    treatment: formulario.treatment || "",
                    weight: formulario.weight !== null ? String(formulario.weight) : "",
                    temperature: formulario.temperature !== null ? String(formulario.temperature) : "",
                    vaccines: formulario.vaccines || "",
                    observations: formulario.observations || "",
                  }}
                  textoBoton="Guardar cambios"
                  onGuardar={(datos) => guardarEdicion(formulario.id, datos)}
                  onCancelar={() => setFormulario(null)}
                />
              </div>
            )}

            <div className="tarjeta">
              <h3>Consultas ({vigentes.length})</h3>
              {vigentes.length === 0 ? (
                <div className="estado-vacio estado-vacio-compacto">
                  <span className="estado-vacio-icono">
                    <Icono nombre="documento" tamano={26} />
                  </span>
                  <div>
                    <h2>Sin consultas registradas</h2>
                    <p className="texto-suave">
                      {esVeterinario
                        ? `Aún no hay entradas en la historia de ${pet.name}.`
                        : `Todavía no hay registros en la historia clínica de ${pet.name}. El veterinario los agrega después de cada consulta.`}
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="historia">
                  {vigentes.map((entrada) => (
                    <Entrada
                      key={entrada.id}
                      entrada={entrada}
                      esVeterinario={esVeterinario}
                      onEditar={(e) => {
                        setFormulario(e);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      onEliminar={eliminar}
                      onCambio={cargar}
                    />
                  ))}
                </ul>
              )}
            </div>

            {esVeterinario && anuladas.length > 0 && (
              <div className="tarjeta no-imprimir">
                <button type="button" className="enlace-accion" onClick={() => setMostrarAnuladas((v) => !v)}>
                  {mostrarAnuladas ? "Ocultar" : "Ver"} entradas eliminadas ({anuladas.length})
                </button>
                {mostrarAnuladas && (
                  <ul className="historia">
                    {anuladas.map((entrada) => (
                      <Entrada key={entrada.id} entrada={entrada} esVeterinario />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default HistoriaClinica;
