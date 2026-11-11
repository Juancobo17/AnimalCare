// Paso 2 de "olvidé mi contraseña": crear la nueva con el enlace del correo.
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { usarTitulo } from "../hooks/usarTitulo";
import AuthLayout from "../components/AuthLayout";
import Alerta from "../components/Alerta";
import { restablecerContrasena, contrasenaValida, MENSAJE_CONTRASENA } from "../services/account.service";
import { obtenerMensajesDeError } from "../services/api";

function RestablecerContrasena() {
  usarTitulo("Nueva contraseña");
  const [parametros] = useSearchParams();
  const navigate = useNavigate();
  const token = parametros.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [errores, setErrores] = useState([]);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    const mensajes = [];
    if (!contrasenaValida(password)) mensajes.push(MENSAJE_CONTRASENA);
    if (password !== confirmacion) mensajes.push("Las contraseñas no coinciden.");
    if (mensajes.length > 0) {
      setErrores(mensajes);
      return;
    }
    setErrores([]);
    setEnviando(true);
    try {
      const r = await restablecerContrasena(token, password);
      navigate("/login", { state: { mensaje: r.message } });
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout>
      <h1>Nueva contraseña</h1>
      <p className="auth-subtitulo">Elige una contraseña que no uses en otros sitios.</p>

      {!token && (
        <Alerta tipo="error" mensajes={["El enlace está incompleto. Vuelve a pedir uno desde \"¿Olvidaste tu contraseña?\"."]} />
      )}
      <Alerta tipo="error" mensajes={errores} />

      {token && (
        <form onSubmit={enviar} noValidate>
          <div className="campo">
            <label htmlFor="password">
              Nueva contraseña <span className="obligatorio">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres y un número"
              autoComplete="new-password"
            />
          </div>
          <div className="campo">
            <label htmlFor="confirmacion">
              Repite la contraseña <span className="obligatorio">*</span>
            </label>
            <input
              id="confirmacion"
              type="password"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="boton boton-primario" disabled={enviando}>
            {enviando ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      )}

      <p className="auth-pie">
        <Link to="/recuperar">Pedir un enlace nuevo</Link> · <Link to="/login">Iniciar sesión</Link>
      </p>
    </AuthLayout>
  );
}

export default RestablecerContrasena;
