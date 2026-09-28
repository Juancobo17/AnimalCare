import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import CitaTarjeta from "../components/CitaTarjeta";
import { obtenerUsuario } from "../services/auth.service";
import { listarMisCitas } from "../services/appointment.service";
import { MODALIDADES } from "../services/vet.service";
import { obtenerMensajesDeError } from "../services/api";

// Cuantas citas proximas se muestran en el panel.
const CITAS_EN_PANEL = 3;

function Dashboard() {
  const usuario = obtenerUsuario();
  const esVeterinario = usuario?.role === "VETERINARIAN";

  const [citas, setCitas] = useState([]);
  const [errores, setErrores] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const resultado = await listarMisCitas();
        setCitas(resultado);
      } catch (error) {
        setErrores(obtenerMensajesDeError(error));
      } finally {
        setCargando(false);
      }
    }

    cargar();
  }, []);

  const proximas = citas.slice(0, CITAS_EN_PANEL);

  return (
    <div className="pagina">
      <Cabecera />

      <main className="contenedor">
        <div className="tarjeta">
          <h1>Hola, {usuario?.name}</h1>
          <p className="texto-suave">
            {esVeterinario
              ? "Este es tu panel profesional. Aquí ves las citas que te agendaron."
              : "Bienvenido a tu panel de AnimalCare. Busca un veterinario y agenda una cita."}
          </p>

          {!esVeterinario && (
            <div className="acciones acciones-panel">
              <Link to="/veterinarios" className="boton boton-primario boton-auto">
                Buscar veterinario
              </Link>
              <Link to="/citas" className="boton boton-secundario boton-auto">
                Ver mis citas
              </Link>
            </div>
          )}
        </div>

        {/* Resumen del perfil profesional del veterinario */}
        {esVeterinario && usuario?.vetProfile && (
          <div className="tarjeta">
            <h3>Mi perfil profesional</h3>
            <dl className="datos">
              <div>
                <dt>Especialidad</dt>
                <dd>{usuario.vetProfile.specialty}</dd>
              </div>
              <div>
                <dt>Matrícula</dt>
                <dd>{usuario.vetProfile.license}</dd>
              </div>
              <div>
                <dt>Modalidades</dt>
                <dd>
                  {[
                    usuario.vetProfile.clinicService ? MODALIDADES.CLINIC : null,
                    usuario.vetProfile.homeService ? MODALIDADES.HOME : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div className="tarjeta">
          <div className="encabezado-seccion">
            <h3>{esVeterinario ? "Próximas citas de mi agenda" : "Mis próximas citas"}</h3>
            {citas.length > CITAS_EN_PANEL && (
              <Link to="/citas" className="enlace-seccion">
                Ver todas ({citas.length})
              </Link>
            )}
          </div>

          <Alerta tipo="error" mensajes={errores} />

          {cargando && <p className="texto-suave">Cargando...</p>}

          {!cargando && proximas.length === 0 && errores.length === 0 && (
            <p className="texto-suave">
              {esVeterinario
                ? "Todavía no tienes citas agendadas."
                : "Aún no tienes citas. Busca un veterinario para agendar la primera."}
            </p>
          )}

          <div className="lista-citas">
            {proximas.map((cita) => (
              <CitaTarjeta
                key={cita.id}
                cita={cita}
                perspectiva={esVeterinario ? "veterinario" : "cliente"}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
