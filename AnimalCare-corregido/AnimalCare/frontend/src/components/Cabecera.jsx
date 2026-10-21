// Barra superior compartida por todas las pantallas privadas.
// El menu cambia segun el rol: el cliente busca veterinarios y el
// veterinario consulta su agenda.
import { Link, NavLink, useNavigate } from "react-router-dom";

import Huella from "./Huella";
import { obtenerUsuario, cerrarSesion } from "../services/auth.service";

function Cabecera() {
  const navigate = useNavigate();
  const usuario = obtenerUsuario();
  const esVeterinario = usuario?.role === "VETERINARIAN";

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
        {!esVeterinario && (
          <NavLink to="/veterinarios" className="cabecera-enlace">
            Veterinarios
          </NavLink>
        )}
        <NavLink to="/citas" className="cabecera-enlace">
          {esVeterinario ? "Mi agenda" : "Mis citas"}
        </NavLink>
      </nav>

      <button
        type="button"
        className="boton boton-secundario boton-auto"
        onClick={manejarCierreDeSesion}
      >
        Cerrar sesión
      </button>
    </header>

    {/* Sprint 1: el veterinario conserva acceso completo; la verificacion
        del Administrador se implementa en el Sprint 2. */}
    {esVeterinario && (
      <div className="aviso-verificacion" role="status">
        <strong>Cuenta pendiente de verificación.</strong> Tu matrícula profesional aún no ha sido
        validada. Por ahora puedes usar la plataforma con normalidad; la verificación completa
        estará disponible próximamente.
      </div>
    )}
    </>
  );
}

export default Cabecera;
