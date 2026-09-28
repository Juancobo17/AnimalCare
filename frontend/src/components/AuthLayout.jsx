// Estructura visual compartida por las pantallas de login y registro.
import Huella from "./Huella";
import Carrusel from "./Carrusel";
import "../auth.css";

// ancho: el registro de veterinario pide mas datos y necesita una tarjeta
// mas amplia para que el formulario no quede apretado.
function AuthLayout({ children, ancho = false }) {
  return (
    <div className="auth">
      <section className="auth-presentacion">
        <div className="auth-marca">
          <Huella tamano={38} color="#ffffff" />
          <span>AnimalCare</span>
        </div>

        <Carrusel />
      </section>

      <section className="auth-formulario">
        <div className={`auth-tarjeta ${ancho ? "auth-tarjeta-ancha" : ""}`}>
          <div className="auth-marca-movil">
            <Huella tamano={28} color="#1c6742" />
            <span>AnimalCare</span>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}

export default AuthLayout;
