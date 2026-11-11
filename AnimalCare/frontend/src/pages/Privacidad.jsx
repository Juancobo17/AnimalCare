// Politica de privacidad y tratamiento de datos personales (Ley 1581 de 2012).
// Pagina publica: se enlaza desde el registro y desde "Mi cuenta".
import { Link } from "react-router-dom";

import Huella from "../components/Huella";
import { haySesionActiva } from "../services/auth.service";

function Privacidad() {
  return (
    <div className="pagina">
      <header className="cabecera">
        <div className="cabecera-interior">
          <Link to={haySesionActiva() ? "/dashboard" : "/login"} className="cabecera-marca" aria-label="AnimalCare">
            <Huella tamano={26} color="#1c6742" />
            <span>AnimalCare</span>
          </Link>
        </div>
      </header>
      <main className="contenedor documento">
        <div className="tarjeta">
          <h1>Política de privacidad y tratamiento de datos</h1>
          <p className="texto-suave">Última actualización: noviembre de 2026. Proyecto académico de AnimalCare.</p>

          <h3>1. Responsable del tratamiento</h3>
          <p>
            AnimalCare es un proyecto universitario de la materia Aseguramiento de la Calidad del Software y
            Pruebas. El equipo del proyecto actúa como responsable del tratamiento de los datos que registras en
            la plataforma.
          </p>

          <h3>2. Datos que recogemos</h3>
          <ul>
            <li><strong>Cuenta:</strong> nombre, correo electrónico y contraseña (guardada cifrada).</li>
            <li><strong>Veterinarios:</strong> matrícula profesional, especialidad, teléfono, dirección del consultorio, presentación, foto y el documento de la tarjeta profesional.</li>
            <li><strong>Mascotas:</strong> nombre, especie, sexo, fecha de nacimiento y peso.</li>
            <li><strong>Citas e historias clínicas:</strong> fechas, servicios, direcciones de atención a domicilio, motivos de consulta, diagnósticos y tratamientos.</li>
            <li><strong>Reseñas y notificaciones</strong> generadas por el uso de la plataforma.</li>
          </ul>

          <h3>3. Para qué los usamos</h3>
          <ul>
            <li>Conectar a dueños de mascotas con veterinarios y gestionar las citas.</li>
            <li>Verificar que los veterinarios tengan una matrícula válida (solo el administrador ve la tarjeta profesional).</li>
            <li>Enviar avisos sobre tus citas, tu cuenta y recordatorios.</li>
            <li>Llevar la historia clínica de tus mascotas.</li>
          </ul>

          <h3>4. Con quién se comparten</h3>
          <p>
            Con el veterinario con el que agendas (tu nombre, correo, mascota y dirección si la atención es a
            domicilio) y con el dueño cuyo animal atiendes (tu perfil público). No vendemos ni cedemos datos a
            terceros. La tarjeta profesional solo la ve el administrador.
          </p>

          <h3>5. Tus derechos (Ley 1581 de 2012)</h3>
          <p>
            Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar la autorización. Desde{" "}
            <Link to="/mi-cuenta">Mi cuenta</Link> puedes editar tu nombre, cambiar la contraseña y eliminar tu
            cuenta. Al eliminarla, tus datos personales se anonimizan; las citas pasadas y las historias clínicas se
            conservan como registro de la atención, sin identificarte.
          </p>

          <h3>6. Seguridad y conservación</h3>
          <p>
            Las contraseñas se guardan con cifrado irreversible, el acceso se protege con sesiones firmadas y se
            limitan los intentos de inicio de sesión. Los datos se conservan mientras la cuenta esté activa.
          </p>

          <h3>7. Contacto</h3>
          <p>Para ejercer tus derechos o resolver dudas, escribe al administrador de la plataforma.</p>

          <p className="auth-pie">
            <Link to={haySesionActiva() ? "/dashboard" : "/register"}>Volver</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default Privacidad;
