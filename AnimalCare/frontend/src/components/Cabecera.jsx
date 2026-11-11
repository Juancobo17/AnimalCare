// Barra superior compartida por todas las pantallas privadas.
// El menu cambia segun el rol: el cliente busca veterinarios, el
// veterinario consulta su agenda y el administrador gestiona usuarios.
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import Logo from "./Logo";
import Icono from "./Icono";
import { obtenerUsuario, cerrarSesion, esVeterinarioPendiente } from "../services/auth.service";
import { listarNotificaciones } from "../services/notification.service";
import { inicialesDe, primerNombreDe } from "../utils/nombres";

function Cabecera() {
  const navigate = useNavigate();
  const usuario = obtenerUsuario();
  const esVeterinario = usuario?.role === "VETERINARIAN";
  const esAdministrador = usuario?.role === "ADMIN";
  // AN-8 escenario 3: mientras la matricula no se valida, se ocultan las
  // funciones principales del veterinario.
  const pendiente = esVeterinarioPendiente(usuario);
  const [sinLeer, setSinLeer] = useState(0);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef(null);

  // AN-22 / AN-23: contador de notificaciones sin leer.
  useEffect(() => {
    if (esAdministrador) return;
    listarNotificaciones()
      .then((datos) => setSinLeer(datos.unread))
      .catch(() => setSinLeer(0));
  }, [esAdministrador]);

  // El menu de la cuenta se cierra al hacer clic fuera o al pulsar Escape.
  useEffect(() => {
    if (!menuAbierto) return;
    function alClicFuera(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(false);
    }
    function alPulsarTecla(e) {
      if (e.key === "Escape") setMenuAbierto(false);
    }
    document.addEventListener("mousedown", alClicFuera);
    document.addEventListener("keydown", alPulsarTecla);
    return () => {
      document.removeEventListener("mousedown", alClicFuera);
      document.removeEventListener("keydown", alPulsarTecla);
    };
  }, [menuAbierto]);

  // AN-32: cerrar sesion borra el token y devuelve al login con un aviso.
  // Cliente y veterinario siguen el mismo flujo: Login + "Has cerrado sesión correctamente".
  function manejarCierreDeSesion() {
    cerrarSesion();
    navigate("/login", { state: { mensaje: "Has cerrado sesión correctamente" } });
  }

  const primerNombre = primerNombreDe(usuario?.name);
  const rol = esAdministrador ? "Administrador" : esVeterinario ? "Veterinario" : "Cliente";

  return (
    <>
      <header className="cabecera">
        <div className="cabecera-interior">
          <Link to="/dashboard" className="cabecera-marca" aria-label="AnimalCare, ir al inicio">
            <Logo tamano={34} claro />
          </Link>

          <nav className="cabecera-menu" aria-label="Principal">
            <NavLink to="/dashboard" className="cabecera-enlace">
              Inicio
            </NavLink>
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
          </nav>

          <div className="cabecera-acciones">
            {!esAdministrador && (
              <NavLink
                to="/notificaciones"
                className="boton-barra campana"
                aria-label={`Notificaciones${sinLeer > 0 ? ` (${sinLeer} sin leer)` : ""}`}
              >
                <Icono nombre="campana" tamano={22} />
                {sinLeer > 0 && <span className="campana-contador">{sinLeer > 9 ? "9+" : sinLeer}</span>}
              </NavLink>
            )}

            <div className="cuenta" ref={menuRef}>
              <button
                type="button"
                className="cuenta-boton"
                aria-haspopup="menu"
                aria-expanded={menuAbierto}
                onClick={() => setMenuAbierto((v) => !v)}
              >
                <span className="avatar">{inicialesDe(usuario?.name)}</span>
                <span className="cuenta-nombre">{primerNombre}</span>
                <Icono nombre="abajo" tamano={16} grosor={2} />
              </button>

              {menuAbierto && (
                <div className="cuenta-menu" role="menu">
                  <div className="cuenta-datos">
                    <strong>{usuario?.name}</strong>
                    <span>{rol}</span>
                  </div>
                  {esVeterinario && (
                    <Link to="/mi-perfil" className="cuenta-opcion" role="menuitem" onClick={() => setMenuAbierto(false)}>
                      <Icono nombre="perfil" tamano={18} />
                      Mi perfil
                    </Link>
                  )}
                  <Link to="/mi-cuenta" className="cuenta-opcion" role="menuitem" onClick={() => setMenuAbierto(false)}>
                    <Icono nombre="perfil" tamano={18} />
                    Mi cuenta
                  </Link>
                  <button type="button" className="cuenta-opcion" role="menuitem" onClick={manejarCierreDeSesion}>
                    <Icono nombre="salir" tamano={18} />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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
