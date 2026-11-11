// Paso 1 de "olvidé mi contraseña": pedir el enlace por correo.
import { useState } from "react";
import { Link } from "react-router-dom";

import { usarTitulo } from "../hooks/usarTitulo";
import AuthLayout from "../components/AuthLayout";
import Alerta from "../components/Alerta";
import { solicitarRecuperacion } from "../services/account.service";
import { obtenerMensajesDeError } from "../services/api";

function RecuperarContrasena() {
  usarTitulo("Recuperar contraseña");
  const [email, setEmail] = useState("");
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    if (email.trim() === "") {
      setErrores(["Escribe el correo con el que te registraste."]);
      return;
    }
    setErrores([]);
    setEnviando(true);
    try {
      const r = await solicitarRecuperacion(email.trim());
      setExito([r.message]);
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout>
      <h1>Recuperar contraseña</h1>
      <p className="auth-subtitulo">Te enviaremos un enlace para crear una contraseña nueva.</p>

      <Alerta tipo="exito" fijo mensajes={exito} />
      <Alerta tipo="error" mensajes={errores} />

      {exito.length === 0 && (
        <form onSubmit={enviar} noValidate>
          <div className="campo">
            <label htmlFor="email">
              Correo electrónico <span className="obligatorio">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              autoComplete="email"
            />
          </div>
          <button type="submit" className="boton boton-primario" disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>
      )}

      <p className="auth-pie">
        <Link to="/login">Volver a iniciar sesión</Link>
      </p>
    </AuthLayout>
  );
}

export default RecuperarContrasena;
