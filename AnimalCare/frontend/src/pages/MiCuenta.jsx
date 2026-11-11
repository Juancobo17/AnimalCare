// Mi cuenta: datos personales, verificacion del correo, contraseña y
// eliminacion de la cuenta (derechos de la Ley 1581 de proteccion de datos).
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { usarTitulo } from "../hooks/usarTitulo";
import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import { obtenerUsuario, cerrarSesion } from "../services/auth.service";
import {
  actualizarCuenta,
  cambiarContrasena,
  eliminarCuenta,
  reenviarVerificacion,
  contrasenaValida,
  MENSAJE_CONTRASENA,
} from "../services/account.service";
import { obtenerMensajesDeError } from "../services/api";

function MiCuenta() {
  usarTitulo("Mi cuenta");
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(obtenerUsuario);
  const esAdministrador = usuario?.role === "ADMIN";

  const [nombre, setNombre] = useState(usuario?.name || "");
  const [claves, setClaves] = useState({ actual: "", nueva: "", confirmacion: "" });
  const [claveEliminar, setClaveEliminar] = useState("");
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [exito, setExito] = useState([]);
  const [errores, setErrores] = useState([]);
  const [ocupado, setOcupado] = useState("");

  async function ejecutar(nombreAccion, accion) {
    setExito([]);
    setErrores([]);
    setOcupado(nombreAccion);
    try {
      await accion();
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setOcupado("");
    }
  }

  function guardarNombre(e) {
    e.preventDefault();
    ejecutar("nombre", async () => {
      const r = await actualizarCuenta({ name: nombre.trim() });
      localStorage.setItem("usuario", JSON.stringify(r.user));
      setUsuario(r.user);
      setExito([r.message]);
    });
  }

  function guardarClave(e) {
    e.preventDefault();
    const mensajes = [];
    if (!claves.actual) mensajes.push("Escribe tu contraseña actual.");
    if (!contrasenaValida(claves.nueva)) mensajes.push(MENSAJE_CONTRASENA);
    if (claves.nueva !== claves.confirmacion) mensajes.push("Las contraseñas nuevas no coinciden.");
    if (mensajes.length > 0) {
      setExito([]);
      setErrores(mensajes);
      return;
    }
    ejecutar("clave", async () => {
      const r = await cambiarContrasena(claves.actual, claves.nueva);
      setClaves({ actual: "", nueva: "", confirmacion: "" });
      setExito([r.message]);
    });
  }

  function reenviar() {
    ejecutar("verificacion", async () => setExito([(await reenviarVerificacion()).message]));
  }

  function eliminar(e) {
    e.preventDefault();
    ejecutar("eliminar", async () => {
      const r = await eliminarCuenta(claveEliminar);
      cerrarSesion();
      navigate("/login", { state: { mensaje: r.message } });
    });
  }

  return (
    <div className="pagina">
      <Cabecera />
      <main className="contenedor contenedor-medio">
        <div className="tarjeta">
          <h1>Mi cuenta</h1>
          <p className="texto-suave">
            Tus datos de acceso y tus derechos sobre la información que guardamos. Consulta la{" "}
            <Link to="/privacidad">política de privacidad</Link>.
          </p>
        </div>

        <Alerta tipo="exito" mensajes={exito} />
        <Alerta tipo="error" mensajes={errores} />

        <div className="tarjeta">
          <h3>Correo</h3>
          <p>
            {usuario?.email}{" "}
            {usuario?.emailVerified ? (
              <span className="etiqueta etiqueta-confirmed">Confirmado</span>
            ) : (
              <span className="etiqueta etiqueta-pending">Sin confirmar</span>
            )}
          </p>
          {!usuario?.emailVerified && (
            <>
              <p className="texto-suave">
                Confirma tu correo con el enlace que te enviamos. Lo necesitas para recuperar tu contraseña si la olvidas.
              </p>
              <button type="button" className="boton boton-secundario boton-auto" onClick={reenviar} disabled={ocupado === "verificacion"}>
                {ocupado === "verificacion" ? "Enviando..." : "Reenviar enlace de confirmación"}
              </button>
            </>
          )}
        </div>

        <form className="tarjeta" onSubmit={guardarNombre} noValidate>
          <h3>Datos personales</h3>
          <div className="campo">
            <label htmlFor="nombre">
              Nombre completo <span className="obligatorio">*</span>
            </label>
            <input id="nombre" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <button type="submit" className="boton boton-primario boton-auto" disabled={ocupado === "nombre"}>
            {ocupado === "nombre" ? "Guardando..." : "Guardar"}
          </button>
        </form>

        <form className="tarjeta" onSubmit={guardarClave} noValidate>
          <h3>Cambiar contraseña</h3>
          <div className="campo">
            <label htmlFor="actual">
              Contraseña actual <span className="obligatorio">*</span>
            </label>
            <input id="actual" type="password" autoComplete="current-password" value={claves.actual} onChange={(e) => setClaves({ ...claves, actual: e.target.value })} />
          </div>
          <div className="fila">
            <div className="campo">
              <label htmlFor="nueva">
                Nueva contraseña <span className="obligatorio">*</span>
              </label>
              <input id="nueva" type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres y un número" value={claves.nueva} onChange={(e) => setClaves({ ...claves, nueva: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="confirmacion">
                Repite la nueva <span className="obligatorio">*</span>
              </label>
              <input id="confirmacion" type="password" autoComplete="new-password" value={claves.confirmacion} onChange={(e) => setClaves({ ...claves, confirmacion: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="boton boton-primario boton-auto" disabled={ocupado === "clave"}>
            {ocupado === "clave" ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </form>

        {!esAdministrador && (
          <div className="tarjeta zona-peligro">
            <h3>Eliminar mi cuenta</h3>
            <p className="texto-suave">
              Se cancelarán tus citas futuras y tus datos personales se anonimizarán. Las citas pasadas,
              reseñas e historias clínicas se conservan sin identificarte. Esta acción no se puede deshacer.
            </p>
            {!confirmarEliminar ? (
              <button type="button" className="boton boton-peligro boton-auto" onClick={() => setConfirmarEliminar(true)}>
                Quiero eliminar mi cuenta
              </button>
            ) : (
              <form onSubmit={eliminar} noValidate>
                <div className="campo">
                  <label htmlFor="clave-eliminar">Confirma con tu contraseña</label>
                  <input id="clave-eliminar" type="password" autoComplete="current-password" value={claveEliminar} onChange={(e) => setClaveEliminar(e.target.value)} />
                </div>
                <div className="acciones-linea">
                  <button type="submit" className="boton boton-peligro boton-auto" disabled={ocupado === "eliminar" || claveEliminar === ""}>
                    {ocupado === "eliminar" ? "Eliminando..." : "Eliminar definitivamente"}
                  </button>
                  <button type="button" className="boton boton-secundario boton-auto" onClick={() => setConfirmarEliminar(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default MiCuenta;
