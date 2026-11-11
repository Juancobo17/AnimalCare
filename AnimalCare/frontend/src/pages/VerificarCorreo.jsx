// Confirma el correo con el enlace que llego por correo.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { usarTitulo } from "../hooks/usarTitulo";
import AuthLayout from "../components/AuthLayout";
import Alerta from "../components/Alerta";
import { verificarCorreo } from "../services/account.service";
import { obtenerUsuario, actualizarUsuario, haySesionActiva } from "../services/auth.service";
import { obtenerMensajesDeError } from "../services/api";

function VerificarCorreo() {
  usarTitulo("Verificar correo");
  const [parametros] = useSearchParams();
  const token = parametros.get("token") || "";
  const [estado, setEstado] = useState(token ? "verificando" : "error");
  const [mensaje, setMensaje] = useState(token ? "" : "El enlace está incompleto.");

  useEffect(() => {
    if (!token) return;
    verificarCorreo(token)
      .then(async (r) => {
        setEstado("ok");
        setMensaje(r.message);
        // Si hay sesion abierta, se refresca el usuario para quitar el aviso.
        if (haySesionActiva()) {
          try {
            await actualizarUsuario();
          } catch {
            // Sin cambios si falla.
          }
        }
      })
      .catch((error) => {
        setEstado("error");
        setMensaje(obtenerMensajesDeError(error)[0]);
      });
  }, [token]);

  const sesion = haySesionActiva() && obtenerUsuario();

  return (
    <AuthLayout>
      <h1>Confirmación de correo</h1>
      {estado === "verificando" && <p className="texto-suave">Confirmando tu correo...</p>}
      <Alerta tipo="exito" fijo mensajes={estado === "ok" ? [mensaje] : []} />
      <Alerta tipo="error" mensajes={estado === "error" ? [mensaje] : []} />
      <p className="auth-pie">
        {sesion ? <Link to="/dashboard">Ir a mi panel</Link> : <Link to="/login">Iniciar sesión</Link>}
        {estado === "error" && sesion && (
          <>
            {" "}
            · <Link to="/mi-cuenta">Pedir un enlace nuevo</Link>
          </>
        )}
      </p>
    </AuthLayout>
  );
}

export default VerificarCorreo;
