// Servicios del veterinario.
// AN-28 agregar, AN-29 eliminar, AN-30 asignar y modificar precios.
import { useEffect, useState } from "react";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import {
  listarMisServicios,
  agregarServicio,
  actualizarServicio,
  eliminarServicio,
} from "../services/vetPanel.service";
import { formatearPrecio } from "../services/vet.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

const SERVICIO_VACIO = { name: "", price: "", durationMinutes: "30", description: "" };
const DURACIONES = [15, 30, 45, 60, 90, 120, 180, 240];

// AN-30 criterio 3: el campo de precio no deja escribir letras, simbolos ni el signo menos.
function soloPrecio(valor) {
  const limpio = valor.replace(/[^0-9.]/g, "");
  const [entero, ...resto] = limpio.split(".");
  return resto.length > 0 ? `${entero}.${resto.join("").slice(0, 2)}` : entero;
}

// Validacion previa al envio (el backend vuelve a validar lo mismo).
function validar(servicio) {
  const errores = [];
  if (servicio.name.trim() === "" || servicio.price === "" || servicio.durationMinutes === "") {
    errores.push("Todos los campos son obligatorios: nombre, precio y duración.");
  }
  if (servicio.price !== "" && !(Number(servicio.price) > 0)) {
    errores.push("El precio solo admite valores numéricos mayores a cero.");
  }
  return errores;
}

function FormularioServicio({ inicial, textoBoton, onGuardar, onCancelar }) {
  const [datos, setDatos] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState([]);

  function cambiar(evento) {
    const { name, value } = evento.target;
    setDatos((anterior) => ({ ...anterior, [name]: name === "price" ? soloPrecio(value) : value }));
  }

  async function enviar(evento) {
    evento.preventDefault();
    const mensajes = validar(datos);
    if (mensajes.length > 0) {
      setErrores(mensajes);
      return;
    }
    setErrores([]);
    setGuardando(true);
    try {
      await onGuardar({
        name: datos.name.trim(),
        price: datos.price,
        durationMinutes: Number(datos.durationMinutes),
        description: datos.description.trim(),
      });
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="formulario-servicio">
      <Alerta tipo="error" mensajes={errores} />
      <div className="fila">
        <div className="campo">
          <label htmlFor={`nombre-${textoBoton}`}>
            Nombre del servicio <span className="obligatorio">*</span>
          </label>
          <input
            id={`nombre-${textoBoton}`}
            name="name"
            value={datos.name}
            onChange={cambiar}
            maxLength={60}
            placeholder="Consulta general, vacunación..."
          />
        </div>
        <div className="fila">
          <div className="campo">
            <label htmlFor={`precio-${textoBoton}`}>
              Precio (COP) <span className="obligatorio">*</span>
            </label>
            <input
              id={`precio-${textoBoton}`}
              name="price"
              inputMode="decimal"
              value={datos.price}
              onChange={cambiar}
              placeholder="50000"
            />
          </div>
          <div className="campo">
            <label htmlFor={`duracion-${textoBoton}`}>
              Duración <span className="obligatorio">*</span>
            </label>
            <select
              id={`duracion-${textoBoton}`}
              name="durationMinutes"
              value={datos.durationMinutes}
              onChange={cambiar}
            >
              {DURACIONES.map((minutos) => (
                <option key={minutos} value={String(minutos)}>
                  {minutos} min
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="campo">
        <label htmlFor={`descripcion-${textoBoton}`}>Descripción (opcional)</label>
        <input
          id={`descripcion-${textoBoton}`}
          name="description"
          value={datos.description}
          onChange={cambiar}
          maxLength={300}
        />
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

function MisServicios() {
  const [servicios, setServicios] = useState([]);
  const [visible, setVisible] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);
  const [sinConexion, setSinConexion] = useState(false);
  const [intento, setIntento] = useState(0);
  const [editando, setEditando] = useState(null);
  const [eliminando, setEliminando] = useState(null);
  const [claveFormulario, setClaveFormulario] = useState(0);

  async function cargar() {
    const datos = await listarMisServicios();
    setServicios(datos.services);
    setVisible(datos.visible);
  }

  useEffect(() => {
    setCargando(true);
    setErrores([]);
    cargar()
      .catch((error) => {
        setErrores(obtenerMensajesDeError(error));
        setSinConexion(esErrorDeConexion(error));
      })
      .finally(() => setCargando(false));
  }, [intento]);

  async function manejarAgregar(servicio) {
    setExito([]);
    const resultado = await agregarServicio(servicio);
    await cargar();
    setExito([resultado.message]);
    // Se reinicia el formulario de alta.
    setClaveFormulario((n) => n + 1);
  }

  async function manejarEditar(id, servicio) {
    setExito([]);
    const resultado = await actualizarServicio(id, servicio);
    await cargar();
    setEditando(null);
    setExito([resultado.message]);
  }

  async function confirmarEliminar(id) {
    setExito([]);
    setErrores([]);
    try {
      const resultado = await eliminarServicio(id);
      await cargar();
      setExito([resultado.message]);
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setEliminando(null);
    }
  }

  return (
    <div className="pagina">
      <Cabecera />

      <main className="contenedor">
        <div className="tarjeta">
          <h1>Mis servicios</h1>
          <p className="texto-suave">
            Los servicios y precios que publiques aquí son los que ven los dueños de mascotas al
            revisar tu perfil y agendar una cita.
          </p>
          {!visible && (
            <p className="aviso-verificacion">
              Tu cuenta está pendiente de verificación: tus servicios se guardan, pero no aparecerán
              en el buscador hasta que un administrador apruebe tu perfil.
            </p>
          )}
        </div>

        <Alerta tipo="exito" mensajes={exito} />
        <Alerta
          tipo="error"
          mensajes={errores}
          onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined}
        />

        <div className="tarjeta">
          <h3>Servicios publicados</h3>

          {cargando && <p className="texto-suave">Cargando servicios...</p>}

          {!cargando && servicios.length === 0 && errores.length === 0 && (
            <p className="texto-suave">Aún no has agregado servicios.</p>
          )}

          <ul className="lista-servicios">
            {servicios.map((servicio) => (
              <li key={servicio.id} className="servicio-gestion">
                {editando === servicio.id ? (
                  <FormularioServicio
                    inicial={{
                      name: servicio.name,
                      price: String(servicio.price),
                      durationMinutes: String(servicio.durationMinutes),
                      description: servicio.description || "",
                    }}
                    textoBoton="Guardar cambios"
                    onGuardar={(datos) => manejarEditar(servicio.id, datos)}
                    onCancelar={() => setEditando(null)}
                  />
                ) : (
                  <>
                    <div>
                      <strong>{servicio.name}</strong>
                      <span className="texto-suave"> · {servicio.durationMinutes} min</span>
                      {servicio.description && <p className="texto-suave">{servicio.description}</p>}
                    </div>
                    <div className="servicio-gestion-acciones">
                      <span className="precio">{formatearPrecio(servicio.price)}</span>
                      {eliminando === servicio.id ? (
                        <div className="cita-confirmacion acciones-linea" role="alertdialog">
                          <span>¿Eliminar este servicio?</span>
                          <button
                            type="button"
                            className="boton boton-peligro boton-auto"
                            onClick={() => confirmarEliminar(servicio.id)}
                          >
                            Sí, eliminar
                          </button>
                          <button
                            type="button"
                            className="boton boton-secundario boton-auto"
                            onClick={() => setEliminando(null)}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="acciones-linea">
                          <button
                            type="button"
                            className="boton boton-secundario boton-auto"
                            onClick={() => {
                              setEditando(servicio.id);
                              setEliminando(null);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="boton boton-peligro boton-auto"
                            onClick={() => {
                              setEliminando(servicio.id);
                              setEditando(null);
                            }}
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="tarjeta">
          <h3>Agregar servicio</h3>
          <FormularioServicio
            key={claveFormulario}
            inicial={SERVICIO_VACIO}
            textoBoton="Agregar servicio"
            onGuardar={manejarAgregar}
          />
        </div>
      </main>
    </div>
  );
}

export default MisServicios;
