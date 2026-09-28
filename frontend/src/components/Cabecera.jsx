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

  // AN-32: cerrar sesion borra el token y devuelve al login.
  function manejarCierreDeSesion() {
    cerrarSesion();
    navigate("/login");
  }

  return (
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
  );
}

export default Cabecera;
