// Mascotas del dueño: registrar, editar y quitar de la lista.
// Al agendar una cita se elige cuál de ellas se atiende.
import { useEffect, useState } from "react";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import {
  listarMascotas,
  registrarMascota,
  actualizarMascota,
  desactivarMascota,
  ESPECIES,
  ICONO_ESPECIE,
  calcularEdad,
} from "../services/pet.service";
import { hoyUTC } from "../services/appointment.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

const VACIA = { name: "", species: "Perro", sex: "Macho", birthDate: "", weight: "" };

function FormularioMascota({ inicial, textoBoton, onGuardar, onCancelar }) {
  const [datos, setDatos] = useState(inicial);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);

  function cambiar(e) {
    const { name, value } = e.target;
    setDatos((a) => ({ ...a, [name]: name === "weight" ? value.replace(/[^0-9.]/g, "") : value }));
  }

  async function enviar(e) {
    e.preventDefault();
    const mensajes = [];
    if (datos.name.trim() === "") mensajes.push("El nombre de la mascota es obligatorio.");
    if (!datos.birthDate) mensajes.push("La fecha de nacimiento es obligatoria (puede ser aproximada).");
    if (mensajes.length > 0) {
      setErrores(mensajes);
      return;
    }
    setErrores([]);
    setGuardando(true);
    try {
      await onGuardar({ ...datos, name: datos.name.trim(), weight: datos.weight || null });
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setGuardando(false);
    }
  }

  const id = (campo) => `${campo}-${textoBoton.replace(/\s/g, "")}`;

  return (
    <form onSubmit={enviar} noValidate>
      <Alerta tipo="error" mensajes={errores} />
      <div className="fila">
        <div className="campo">
          <label htmlFor={id("nombre")}>
            Nombre <span className="obligatorio">*</span>
          </label>
          <input id={id("nombre")} name="name" maxLength={40} value={datos.name} onChange={cambiar} placeholder="Luna" />
        </div>
        <div className="campo">
          <label htmlFor={id("especie")}>
            Especie <span className="obligatorio">*</span>
          </label>
          <select id={id("especie")} name="species" value={datos.species} onChange={cambiar}>
            {ESPECIES.map((e) => (
              <option key={e} value={e}>
                {ICONO_ESPECIE[e]} {e}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="fila fila-tres">
        <div className="campo">
          <label htmlFor={id("sexo")}>
            Sexo <span className="obligatorio">*</span>
          </label>
          <select id={id("sexo")} name="sex" value={datos.sex} onChange={cambiar}>
            <option value="Macho">Macho</option>
            <option value="Hembra">Hembra</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor={id("nacimiento")}>
            Nacimiento <span className="obligatorio">*</span>
          </label>
          <input id={id("nacimiento")} type="date" name="birthDate" max={hoyUTC()} value={datos.birthDate} onChange={cambiar} />
        </div>
        <div className="campo">
          <label htmlFor={id("peso")}>Peso (kg)</label>
          <input id={id("peso")} name="weight" inputMode="decimal" value={datos.weight} onChange={cambiar} placeholder="4.5" />
        </div>
      </div>
      <div className="acciones-linea">
        <button type="submit" className="boton boton-primario boton-auto" disabled={guardando}>
          {guardando ? "Guardando..." : textoBoton}
        </button>
        {onCancelar && (
          <button type="button" className="boton boton-secundario boton-auto" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function MisMascotas() {
  const [mascotas, setMascotas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);
  const [sinConexion, setSinConexion] = useState(false);
  const [intento, setIntento] = useState(0);
  const [editando, setEditando] = useState(null);
  const [quitando, setQuitando] = useState(null);
  const [mostrarAlta, setMostrarAlta] = useState(false);

  async function cargar() {
    const datos = await listarMascotas();
    setMascotas(datos.pets);
    if (datos.pets.length === 0) setMostrarAlta(true);
  }

  useEffect(() => {
    setCargando(true);
    cargar()
      .catch((error) => {
        setErrores(obtenerMensajesDeError(error));
        setSinConexion(esErrorDeConexion(error));
      })
      .finally(() => setCargando(false));
  }, [intento]);

  async function alta(datos) {
    const r = await registrarMascota(datos);
    await cargar();
    setExito([r.message]);
    setMostrarAlta(false);
  }

  async function edicion(id, datos) {
    const r = await actualizarMascota(id, datos);
    await cargar();
    setEditando(null);
    setExito([r.message]);
  }

  async function quitar(id) {
    setErrores([]);
    try {
      const r = await desactivarMascota(id);
      await cargar();
      setExito([r.message]);
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setQuitando(null);
    }
  }

  return (
    <div className="pagina">
      <Cabecera />
      <main className="contenedor">
        <div className="tarjeta">
          <div className="encabezado-seccion">
            <h1>Mis mascotas</h1>
            {!mostrarAlta && (
              <button type="button" className="boton boton-primario boton-auto" onClick={() => setMostrarAlta(true)}>
                + Agregar mascota
              </button>
            )}
          </div>
          <p className="texto-suave">
            Registra a tus mascotas para elegir a cuál llevas al agendar. El veterinario verá su especie,
            edad y peso antes de la cita.
          </p>
        </div>

        <Alerta tipo="exito" mensajes={exito} />
        <Alerta tipo="error" mensajes={errores} onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined} />

        {mostrarAlta && (
          <div className="tarjeta">
            <h3>Nueva mascota</h3>
            <FormularioMascota
              inicial={VACIA}
              textoBoton="Registrar mascota"
              onGuardar={alta}
              onCancelar={mascotas.length > 0 ? () => setMostrarAlta(false) : undefined}
            />
          </div>
        )}

        {cargando && <p className="texto-suave">Cargando mascotas...</p>}

        <div className="lista-mascotas">
          {mascotas.map((m) => (
            <article key={m.id} className="tarjeta mascota">
              {editando === m.id ? (
                <FormularioMascota
                  inicial={{ ...m, weight: m.weight === null ? "" : String(m.weight) }}
                  textoBoton="Guardar cambios"
                  onGuardar={(datos) => edicion(m.id, datos)}
                  onCancelar={() => setEditando(null)}
                />
              ) : (
                <>
                  <div className="mascota-icono" aria-hidden="true">
                    {ICONO_ESPECIE[m.species] || "🐾"}
                  </div>
                  <div className="mascota-datos">
                    <h3>{m.name}</h3>
                    <p className="texto-suave">
                      {m.species} · {m.sex} · {calcularEdad(m.birthDate)}
                      {m.weight !== null && ` · ${m.weight} kg`}
                    </p>
                  </div>
                  {quitando === m.id ? (
                    <div className="acciones-linea" role="alertdialog">
                      <span>¿Quitar a {m.name}?</span>
                      <button type="button" className="boton boton-peligro boton-auto" onClick={() => quitar(m.id)}>
                        Sí, quitar
                      </button>
                      <button type="button" className="boton boton-secundario boton-auto" onClick={() => setQuitando(null)}>
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="acciones-linea">
                      <button type="button" className="boton boton-secundario boton-auto" onClick={() => setEditando(m.id)}>
                        Editar
                      </button>
                      <button type="button" className="boton boton-peligro boton-auto" onClick={() => setQuitando(m.id)}>
                        Quitar
                      </button>
                    </div>
                  )}
                </>
              )}
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

export default MisMascotas;
