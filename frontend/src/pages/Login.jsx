import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "../components/AuthLayout";
import Alerta from "../components/Alerta";
import { iniciarSesion } from "../services/auth.service";
import { obtenerMensajesDeError } from "../services/api";

function Login() {
  const navigate = useNavigate();

  const [datos, setDatos] = useState({ email: "", password: "" });
  const [errores, setErrores] = useState([]);
  const [enviando, setEnviando] = useState(false);

  function manejarCambio(evento) {
    const { name, value } = evento.target;
    setDatos((anterior) => ({ ...anterior, [name]: value }));
  }

  // Validaciones del formulario. El backend vuelve a validar lo mismo:
  // estas comprobaciones son solo para dar una respuesta inmediata.
  function validar() {
    const mensajes = [];

    if (datos.email.trim() === "") {
      mensajes.push("El correo es obligatorio.");
    }
    if (datos.password.trim() === "") {
      mensajes.push("La contraseña es obligatoria.");
    }

    return mensajes;
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();

    const mensajes = validar();
    if (mensajes.length > 0) {
      setErrores(mensajes);
      return;
    }

    setErrores([]);
    setEnviando(true);

    try {
      await iniciarSesion({ email: datos.email.trim(), password: datos.password });
      navigate("/dashboard");
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout>
      <h1>Iniciar sesión</h1>
      <p className="auth-subtitulo">Ingresa a tu cuenta para gestionar tus mascotas.</p>

      <Alerta tipo="error" mensajes={errores} />

      <form onSubmit={manejarEnvio} noValidate>
        <div className="campo">
          <label htmlFor="email">
            Correo electrónico <span className="obligatorio">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={datos.email}
            onChange={manejarCambio}
            placeholder="tucorreo@ejemplo.com"
            autoComplete="email"
          />
        </div>

        <div className="campo">
          <label htmlFor="password">
            Contraseña <span className="obligatorio">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={datos.password}
            onChange={manejarCambio}
            placeholder="Tu contraseña"
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="boton boton-primario" disabled={enviando}>
          {enviando ? "Verificando..." : "Entrar"}
        </button>
      </form>

      <p className="auth-pie">
        ¿Aún no tienes cuenta? <Link to="/register">Crear una cuenta</Link>
      </p>
    </AuthLayout>
  );
}

export default Login;
