// Estructura visual compartida por las pantallas de login y registro.
import Logo from "./Logo";
import Carrusel from "./Carrusel";
import "../auth.css";

// ancho: el registro de veterinario pide mas datos y necesita una tarjeta
// mas amplia para que el formulario no quede apretado.
function AuthLayout({ children, ancho = false }) {
  return (
    <div className="auth">
      <section className="auth-presentacion">
        <div className="auth-marca">
          <Logo tamano={44} claro lema />
        </div>

        <Carrusel />
      </section>

      <section className="auth-formulario">
        <div className={`auth-tarjeta ${ancho ? "auth-tarjeta-ancha" : ""}`}>
          <div className="auth-marca-movil">
            <Logo tamano={36} lema />
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}

export default AuthLayout;
