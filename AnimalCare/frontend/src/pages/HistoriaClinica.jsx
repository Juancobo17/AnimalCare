// Historia clínica de una mascota.
// Dueño (AN-21): consulta de solo lectura, en /mascotas/:id/historia.
// Veterinario: crear (AN-18), modificar (AN-20) y eliminar (AN-19) sus
// entradas, en /pacientes/:id. ?cita=ID abre el formulario ligado a esa cita.
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import { obtenerUsuario } from "../services/auth.service";
import { obtenerHistoria, crearEntrada, modificarEntrada, eliminarEntrada } from "../services/medicalRecord.service";
import { ICONO_ESPECIE, calcularEdad } from "../services/pet.service";
import { formatearFecha, hoyLocal } from "../services/appointment.service";
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

function FormularioEntrada({ inicial, citasPendientes = [], textoBoton, onGuardar, onCancelar }) {
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

  async function enviar(e) {
    e.preventDefault();
    const mensajes = [];
    if (datos.reason.trim() === "") mensajes.push("El motivo de consulta es obligatorio.");
    if (datos.diagnosis.trim() === "") mensajes.push("El diagnóstico es obligatorio.");
    if (mensajes.length > 0) {
      setErrores(mensajes);
      return;
    }
    setErrores([]);
    setGuardando(true);
    try {
      await onGuardar(datos);
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
          <label htmlFor="cita">Consulta</label>
          <select id="cita" name="appointmentId" value={datos.appointmentId} onChange={cambiar}>
            <option value="">Sin cita asociada</option>
            {citasPendientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.when} · {c.service}
              </option>
            ))}
          </select>
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

      <div className="acciones-linea">
        <button type="submit" className="boton boton-primario boton-auto" disabled={guardando}>
          {guardando ? "Guardando..." : textoBoton}
        </button>
        <button type="button" className="boton boton-secundario boton-auto" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Entrada({ entrada, esVeterinario, onEditar, onEliminar }) {
  const [eliminando, setEliminando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");

  if (entrada.status === "ANNULLED") {
    return (
      <li className="entrada entrada-anulada">
        <div className="entrada-cabecera">
          <strong>{formatearFecha(entrada.visitDate)}</strong>
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
        <strong>{formatearFecha(entrada.visitDate)}</strong>
        <span className="texto-suave">
          {entrada.vet.name}
          {entrada.vet.specialty ? ` · ${entrada.vet.specialty}` : ""}
          {entrada.edited ? " · editada" : ""}
        </span>
      </div>
      <h4>{entrada.reason}</h4>
      <dl className="entrada-datos">
        <div>
          <dt>Diagnóstico</dt>
          <dd>{entrada.diagnosis}</dd>
        </div>
        {entrada.treatment && (
          <div>
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
          <div>
            <dt>Observaciones</dt>
            <dd>{entrada.observations}</dd>
          </div>
        )}
      </dl>

      {esVeterinario && entrada.canEdit && !eliminando && (
        <div className="acciones-linea no-imprimir">
          <button type="button" className="boton boton-secundario boton-auto" onClick={() => onEditar(entrada)}>
            Modificar
          </button>
          <button type="button" className="boton boton-peligro boton-auto" onClick={() => setEliminando(true)}>
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
  const { id } = useParams();
  const [parametros] = useSearchParams();
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
    const datos = await obtenerHistoria(id);
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

  return (
    <div className="pagina">
      <Cabecera />
      <main className="contenedor">
        <Link to={esVeterinario ? "/citas" : "/mascotas"} className="enlace-volver no-imprimir">
          ← {esVeterinario ? "Volver a mi agenda" : "Volver a mis mascotas"}
        </Link>

        <Alerta tipo="exito" mensajes={exito} />
        <Alerta tipo="error" mensajes={errores} onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined} />

        {!historia && errores.length === 0 && <p className="texto-suave">Cargando historia clínica...</p>}

        {pet && (
          <>
            <div className="tarjeta">
              <div className="encabezado-seccion">
                <div className="mascota">
                  <div className="mascota-icono" aria-hidden="true">
                    {ICONO_ESPECIE[pet.species] || "🐾"}
                  </div>
                  <div className="mascota-datos">
                    <h1>Historia clínica de {pet.name}</h1>
                    <p className="texto-suave">
                      {pet.species} · {pet.sex} · {calcularEdad(pet.birthDate)}
                      {pet.weight !== null && ` · ${pet.weight} kg`}
                      {pet.owner && ` · Dueño: ${pet.owner.name}`}
                    </p>
                  </div>
                </div>
                <div className="acciones-linea no-imprimir">
                  {esVeterinario && formulario === null && (
                    <button type="button" className="boton boton-primario boton-auto" onClick={() => setFormulario("nueva")}>
                      + Nueva entrada
                    </button>
                  )}
                  {!esVeterinario && vigentes.length > 0 && (
                    <button type="button" className="boton boton-secundario boton-auto" onClick={() => window.print()}>
                      Imprimir
                    </button>
                  )}
                </div>
              </div>
              {esVeterinario && historia.pendingAppointments?.length > 0 && formulario === null && (
                <p className="aviso-suave">
                  Tienes {historia.pendingAppointments.length} consulta(s) con {pet.name} sin registrar en la historia.
                </p>
              )}
            </div>

            {esVeterinario && formulario === "nueva" && (
              <div className="tarjeta">
                <h3>Nueva entrada</h3>
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
                <p className="texto-suave">
                  {esVeterinario
                    ? `Aún no hay entradas en la historia de ${pet.name}.`
                    : `Todavía no hay registros en la historia clínica de ${pet.name}. El veterinario los agrega después de cada consulta.`}
                </p>
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
