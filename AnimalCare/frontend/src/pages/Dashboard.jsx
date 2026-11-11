import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import CitaTarjeta from "../components/CitaTarjeta";
import Notificaciones from "../components/Notificaciones";
import { listarUsuarios } from "../services/admin.service";
import { obtenerUsuario, actualizarUsuario, esVeterinarioPendiente } from "../services/auth.service";
import { listarMisCitas, esCancelable } from "../services/appointment.service";
import { MODALIDADES } from "../services/vet.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

// Cuantas citas proximas se muestran en el panel.
const CITAS_EN_PANEL = 3;

function Dashboard() {
  const [usuario, setUsuario] = useState(obtenerUsuario);
  const esVeterinario = usuario?.role === "VETERINARIAN";
  const esAdministrador = usuario?.role === "ADMIN";
  const pendiente = esVeterinarioPendiente(usuario);

  // Se refresca el usuario al entrar: si el administrador aprobo la cuenta
  // del veterinario, el panel se habilita sin tener que volver a iniciar sesion.
  useEffect(() => {
    actualizarUsuario()
      .then(setUsuario)
      .catch(() => {
        // Si falla, se sigue con la copia local. Un 401 o 403 ya lo maneja api.js.
      });
  }, []);

  const [citas, setCitas] = useState([]);
  const [errores, setErrores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sinConexion, setSinConexion] = useState(false);
  const [intento, setIntento] = useState(0);
  const [conteos, setConteos] = useState(null);

  // Resumen para el administrador: cuantas cuentas hay en cada estado.
  useEffect(() => {
    if (!esAdministrador) return;
    listarUsuarios()
      .then((datos) => setConteos(datos.counts))
      .catch(() => setConteos(null));
  }, [esAdministrador]);

  useEffect(() => {
    // El administrador y el veterinario pendiente no tienen agenda que cargar.
    if (esAdministrador || pendiente) {
      setCargando(false);
      return;
    }

    async function cargar() {
      setCargando(true);
      setErrores([]);
      setSinConexion(false);
      try {
        const resultado = await listarMisCitas();
        setCitas(resultado);
      } catch (error) {
        setErrores(obtenerMensajesDeError(error));
        setSinConexion(esErrorDeConexion(error));
      } finally {
        setCargando(false);
      }
    }

    cargar();
  }, [intento, esAdministrador, pendiente]);

  // Solo citas activas cuya hora no ha pasado (la API las devuelve de la mas antigua a la mas nueva).
  const futuras = citas.filter(esCancelable);
  const proximas = futuras.slice(0, CITAS_EN_PANEL);

  // AN-8 escenario 3: pantalla bloqueada mientras se valida la matricula.
  if (pendiente) {
    return (
      <div className="pagina">
        <Cabecera />
        <main className="contenedor">
          <div className="tarjeta">
            <h1>Hola, {usuario?.name}</h1>
            <p>Tu perfil está en proceso de verificación. Pronto habilitaremos tu agenda.</p>
            <p className="texto-suave">
              Mientras tanto puedes subir tu tarjeta profesional para agilizar la revisión y dejar
              listos tus servicios y tu horario. Se publicarán cuando tu cuenta sea aprobada.
            </p>
            <div className="acciones acciones-panel">
              <Link to="/mi-perfil" className="boton boton-primario boton-auto">
                Subir tarjeta profesional
              </Link>
              <Link to="/mis-servicios" className="boton boton-secundario boton-auto">
                Mis servicios
              </Link>
              <Link to="/mi-horario" className="boton boton-secundario boton-auto">
                Mi horario
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Panel del administrador. La gestion de usuarios llega con AN-35, AN-37 y AN-38.
  if (esAdministrador) {
    return (
      <div className="pagina">
        <Cabecera />
        <main className="contenedor">
          <div className="tarjeta">
            <h1>Hola, {usuario?.name}</h1>
            <p className="texto-suave">
              Panel de administración de AnimalCare. Revisa y aprueba veterinarios y gestiona las
              cuentas de la plataforma.
            </p>
            <div className="acciones acciones-panel">
              <Link to="/admin/usuarios?estado=PENDING" className="boton boton-primario boton-auto">
                Revisar veterinarios pendientes{conteos ? ` (${conteos.PENDING})` : ""}
              </Link>
              <Link to="/admin/usuarios" className="boton boton-secundario boton-auto">
                Ver todos los usuarios
              </Link>
            </div>
          </div>

          {conteos && (
            <div className="tarjeta">
              <h3>Resumen de cuentas</h3>
              <dl className="datos">
                <div>
                  <dt>Pendientes</dt>
                  <dd>{conteos.PENDING}</dd>
                </div>
                <div>
                  <dt>Activas</dt>
                  <dd>{conteos.ACTIVE}</dd>
                </div>
                <div>
                  <dt>Suspendidas</dt>
                  <dd>{conteos.SUSPENDED}</dd>
                </div>
                <div>
                  <dt>Rechazadas</dt>
                  <dd>{conteos.REJECTED}</dd>
                </div>
              </dl>
            </div>
          )}
        </main>
      </div>
    );
  }

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
              <Link to="/mascotas" className="boton boton-secundario boton-auto">
                Mis mascotas
              </Link>
            </div>
          )}

          {esVeterinario && (
            <div className="acciones acciones-panel">
              <Link to="/citas" className="boton boton-primario boton-auto">
                Ver mi agenda
              </Link>
              <Link to="/mis-servicios" className="boton boton-secundario boton-auto">
                Mis servicios
              </Link>
              <Link to="/mi-horario" className="boton boton-secundario boton-auto">
                Mi horario
              </Link>
            </div>
          )}
        </div>

        <Notificaciones />

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
            {futuras.length > CITAS_EN_PANEL && (
              <Link to="/citas" className="enlace-seccion">
                Ver todas ({futuras.length})
              </Link>
            )}
          </div>

          <Alerta tipo="error" mensajes={errores} onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined} />

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
