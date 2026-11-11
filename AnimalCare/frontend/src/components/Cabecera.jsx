// Barra superior compartida por todas las pantallas privadas.
// El menu cambia segun el rol: el cliente busca veterinarios, el
// veterinario consulta su agenda y el administrador gestiona usuarios.
import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import Huella from "./Huella";
import { obtenerUsuario, cerrarSesion, esVeterinarioPendiente } from "../services/auth.service";
import { listarNotificaciones } from "../services/notification.service";

function Cabecera() {
  const navigate = useNavigate();
  const usuario = obtenerUsuario();
  const esVeterinario = usuario?.role === "VETERINARIAN";
  const esAdministrador = usuario?.role === "ADMIN";
  // AN-8 escenario 3: mientras la matricula no se valida, se ocultan las
  // funciones principales del veterinario.
  const pendiente = esVeterinarioPendiente(usuario);
  const [sinLeer, setSinLeer] = useState(0);

  // AN-22 / AN-23: contador de notificaciones sin leer.
  useEffect(() => {
    if (esAdministrador) return;
    listarNotificaciones()
      .then((datos) => setSinLeer(datos.unread))
      .catch(() => setSinLeer(0));
  }, [esAdministrador]);

  // AN-32: cerrar sesion borra el token y devuelve al login con un aviso.
  // Cliente y veterinario siguen el mismo flujo: Login + "Has cerrado sesión correctamente".
  function manejarCierreDeSesion() {
    cerrarSesion();
    navigate("/login", { state: { mensaje: "Has cerrado sesión correctamente" } });
  }

  return (
    <>
    <header className="cabecera">
      <Link to="/dashboard" className="cabecera-marca">
        <Huella tamano={26} color="#1c6742" />
        <span>AnimalCare</span>
      </Link>

      <nav className="cabecera-menu">
        {!esVeterinario && !esAdministrador && (
          <NavLink to="/veterinarios" className="cabecera-enlace">
            Veterinarios
          </NavLink>
        )}
        {!esAdministrador && !pendiente && (
          <NavLink to="/citas" className="cabecera-enlace">
            {esVeterinario ? "Mi agenda" : "Mis citas"}
          </NavLink>
        )}
        {!esVeterinario && !esAdministrador && (
          <NavLink to="/mascotas" className="cabecera-enlace">
            Mis mascotas
          </NavLink>
        )}
        {/* AN-28 criterio 2: el veterinario pendiente puede ir cargando servicios y horario. */}
        {esVeterinario && (
          <>
            <NavLink to="/mis-servicios" className="cabecera-enlace">
              Mis servicios
            </NavLink>
            <NavLink to="/mi-horario" className="cabecera-enlace">
              Mi horario
            </NavLink>
            <NavLink to="/mi-perfil" className="cabecera-enlace">
              Mi perfil
            </NavLink>
          </>
        )}
        {!esAdministrador && !pendiente && (
          <NavLink to="/urgencias" className="cabecera-enlace">
            Urgencias
          </NavLink>
        )}
        {esAdministrador && (
          <NavLink to="/admin/usuarios" className="cabecera-enlace">
            Usuarios
          </NavLink>
        )}
        <NavLink to="/mi-cuenta" className="cabecera-enlace">
          Mi cuenta
        </NavLink>
        {!esAdministrador && (
          <NavLink
            to="/notificaciones"
            className="cabecera-enlace campana"
            aria-label={`Notificaciones${sinLeer > 0 ? ` (${sinLeer} sin leer)` : ""}`}
          >
            <span aria-hidden="true">🔔</span>
            {sinLeer > 0 && <span className="campana-contador">{sinLeer > 9 ? "9+" : sinLeer}</span>}
          </NavLink>
        )}
      </nav>

      <button
        type="button"
        className="boton boton-secundario boton-auto"
        onClick={manejarCierreDeSesion}
      >
        Cerrar sesión
      </button>
    </header>

    {usuario && usuario.emailVerified === false && !esAdministrador && (
      <div className="aviso-verificacion" role="status">
        <strong>Confirma tu correo.</strong> Te enviamos un enlace a {usuario.email}.{" "}
        <Link to="/mi-cuenta">Reenviar enlace</Link>
      </div>
    )}
    {pendiente && (
      <div className="aviso-verificacion" role="status">
        <strong>Cuenta pendiente de verificación.</strong> Un administrador está revisando tu
        matrícula profesional.
      </div>
    )}
    </>
  );
}

export default Cabecera;
