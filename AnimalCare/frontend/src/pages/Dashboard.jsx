import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { usarTitulo } from "../hooks/usarTitulo";
import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import CitaTarjeta from "../components/CitaTarjeta";
import Notificaciones from "../components/Notificaciones";
import Huella from "../components/Huella";
import Icono from "../components/Icono";
import { primerNombreDe } from "../utils/nombres";
import { listarUsuarios } from "../services/admin.service";
import { obtenerUsuario, actualizarUsuario, esVeterinarioPendiente } from "../services/auth.service";
import { listarMisCitas, esCancelable, ESTADOS_CITA } from "../services/appointment.service";
import { listarMascotas, calcularEdad } from "../services/pet.service";
import { MODALIDADES } from "../services/vet.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

// Cuantas citas se muestran en la lista, ademas de la proxima destacada.
const CITAS_EN_PANEL = 3;

// Colores suaves para el circulo de cada mascota (se reparten en orden).
const TONOS_MASCOTA = ["tono-arena", "tono-cielo", "tono-verde"];

function saludoSegunHora() {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

function fechaDeHoy() {
  const texto = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Partes de la fecha de una cita para el bloque tipo calendario (en UTC, como la API).
function partesDeFecha(fecha) {
  const valor = new Date(`${fecha}T12:00:00Z`);
  const opciones = { timeZone: "UTC" };
  return {
    dia: valor.toLocaleDateString("es-ES", { ...opciones, day: "numeric" }),
    mes: valor.toLocaleDateString("es-ES", { ...opciones, month: "short" }).replace(".", ""),
    semana: valor.toLocaleDateString("es-ES", { ...opciones, weekday: "long" }),
  };
}

function Saludo({ usuario, children, descripcion }) {
  const primerNombre = primerNombreDe(usuario?.name);
  return (
    <section className="inicio-saludo">
      <div className="inicio-saludo-texto">
        <p className="inicio-fecha">{fechaDeHoy()}</p>
        <h1>
          {saludoSegunHora()}
          {primerNombre ? `, ${primerNombre}` : ""}
        </h1>
        {descripcion && <p className="texto-suave">{descripcion}</p>}
      </div>
      {children && <div className="acciones">{children}</div>}
    </section>
  );
}

function Acceso({ to, icono, tono = "", titulo, texto }) {
  return (
    <Link to={to} className="acceso">
      <span className={`acceso-icono ${tono}`}>{icono}</span>
      <span className="acceso-texto">
        <strong>{titulo}</strong>
        <span>{texto}</span>
      </span>
      <span className="acceso-flecha">
        <Icono nombre="flecha" tamano={18} grosor={2} />
      </span>
    </Link>
  );
}

function ProximaCita({ cita, esVeterinario }) {
  const { dia, mes, semana } = partesDeFecha(cita.date);
  const servicio = cita.service ? cita.service.name : "Consulta general";
  const lugar = cita.mode === "HOME" ? cita.address || MODALIDADES.HOME : cita.vet?.address || MODALIDADES.CLINIC;
  const persona = esVeterinario ? cita.client?.name : cita.vet?.name;

  return (
    <section className="tarjeta proxima-cita" aria-label="Próxima cita">
      <div className="bloque-fecha" aria-hidden="true">
        <span className="bloque-fecha-mes">{mes}</span>
        <span className="bloque-fecha-dia">{dia}</span>
        <span className="bloque-fecha-semana">{semana}</span>
      </div>

      <div className="proxima-cita-datos">
        <p className="proxima-cita-etiqueta">Próxima cita</p>
        <h2>
          {servicio}
          {cita.pet && <span className="texto-suave"> · {cita.pet.name}</span>}
        </h2>
        <div className="proxima-cita-detalles">
          <span>
            <Icono nombre="reloj" tamano={16} grosor={2} />
            {cita.time} · {semana} {dia} de {mes}
          </span>
          <span>
            <Icono nombre="ubicacion" tamano={16} grosor={2} />
            {lugar}
          </span>
          {persona && (
            <span>
              <Icono nombre={esVeterinario ? "perfil" : "estetoscopio"} tamano={16} grosor={2} />
              {persona}
            </span>
          )}
        </div>
      </div>

      <div className="proxima-cita-lado">
        <span className={`etiqueta etiqueta-${cita.status.toLowerCase()}`}>{ESTADOS_CITA[cita.status]}</span>
        <Link to="/citas" className="boton boton-secundario boton-auto">
          Ver detalle
        </Link>
      </div>
    </section>
  );
}

function EsqueletoCita() {
  return (
    <div className="tarjeta proxima-cita" aria-hidden="true">
      <div className="esqueleto" style={{ width: 84, height: 96, borderRadius: 12 }} />
      <div className="proxima-cita-datos">
        <div className="esqueleto" style={{ width: 120, height: 14 }} />
        <div className="esqueleto" style={{ width: "60%", height: 22 }} />
        <div className="esqueleto" style={{ width: "80%", height: 14 }} />
      </div>
    </div>
  );
}

function MisMascotasResumen() {
  const [mascotas, setMascotas] = useState(null);

  useEffect(() => {
    listarMascotas()
      .then((datos) => setMascotas(datos.pets))
      .catch(() => setMascotas(null));
  }, []);

  if (!mascotas) return null;

  return (
    <section className="tarjeta tarjeta-lateral">
      <div className="encabezado-seccion">
        <h3>Mis mascotas</h3>
        <Link to="/mascotas" className="enlace-seccion">
          {mascotas.length > 0 ? "Gestionar" : "+ Agregar"}
        </Link>
      </div>
      {mascotas.length === 0 ? (
        <p className="texto-suave">Registra a tu mascota para poder agendarle citas.</p>
      ) : (
        <ul className="resumen-mascotas">
          {mascotas.slice(0, 4).map((m, i) => (
            <li key={m.id}>
              <span className={`mascota-inicial ${TONOS_MASCOTA[i % TONOS_MASCOTA.length]}`}>
                {m.name.charAt(0).toUpperCase()}
              </span>
              <span>
                <strong>{m.name}</strong>
                <span className="texto-suave">
                  {m.species}
                  {m.birthDate ? ` · ${calcularEdad(m.birthDate)}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Dashboard() {
  usarTitulo("Inicio");
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
  const siguiente = futuras[0];
  const resto = futuras.slice(1, 1 + CITAS_EN_PANEL);
  const porConfirmar = futuras.filter((c) => c.status === "PENDING").length;

  // AN-8 escenario 3: pantalla bloqueada mientras se valida la matricula.
  if (pendiente) {
    return (
      <div className="pagina">
        <Cabecera />
        <main className="contenedor contenedor-ancho inicio">
          <Saludo usuario={usuario} />

          <section className="tarjeta estado-vacio estado-espera">
            <span className="estado-vacio-icono tono-arena">
              <Icono nombre="escudo" tamano={28} />
            </span>
            <div>
              <h2>Tu perfil está en proceso de verificación</h2>
              <p className="texto-suave">
                Pronto habilitaremos tu agenda. Mientras tanto puedes subir tu tarjeta profesional para
                agilizar la revisión y dejar listos tus servicios y tu horario. Se publicarán cuando tu
                cuenta sea aprobada.
              </p>
              <Link to="/mi-perfil" className="boton boton-primario boton-auto">
                Subir tarjeta profesional
              </Link>
            </div>
          </section>

          <nav className="accesos" aria-label="Accesos rápidos">
            <Acceso to="/mis-servicios" icono={<Icono nombre="lista" tamano={22} />} titulo="Mis servicios" texto="Precios y duración de cada consulta" />
            <Acceso to="/mi-horario" icono={<Icono nombre="reloj" tamano={22} />} tono="tono-cielo" titulo="Mi horario" texto="Días y horas en que atiendes" />
          </nav>
        </main>
      </div>
    );
  }

  // Panel del administrador. La gestion de usuarios llega con AN-35, AN-37 y AN-38.
  if (esAdministrador) {
    const cifras = [
      { estado: "PENDING", titulo: "Pendientes", clase: "cifra-pendiente" },
      { estado: "ACTIVE", titulo: "Activas", clase: "cifra-activa" },
      { estado: "SUSPENDED", titulo: "Suspendidas", clase: "cifra-suspendida" },
      { estado: "REJECTED", titulo: "Rechazadas", clase: "cifra-rechazada" },
    ];

    return (
      <div className="pagina">
        <Cabecera />
        <main className="contenedor contenedor-ancho inicio">
          <Saludo
            usuario={usuario}
            descripcion={
              conteos?.PENDING
                ? `Hay ${conteos.PENDING} ${conteos.PENDING === 1 ? "veterinario esperando" : "veterinarios esperando"} revisión.`
                : "Revisa y aprueba veterinarios y gestiona las cuentas de la plataforma."
            }
          >
            <Link to="/admin/usuarios?estado=PENDING" className="boton boton-primario boton-auto">
              <Icono nombre="escudo" tamano={18} grosor={2} />
              Revisar pendientes
            </Link>
          </Saludo>

          {conteos && (
            <section className="cifras" aria-label="Resumen de cuentas">
              {cifras.map((c) => (
                <Link key={c.estado} to={`/admin/usuarios?estado=${c.estado}`} className={`cifra ${c.clase}`}>
                  <span className="cifra-valor">{conteos[c.estado] ?? 0}</span>
                  <span className="cifra-titulo">{c.titulo}</span>
                </Link>
              ))}
            </section>
          )}

          <nav className="accesos" aria-label="Accesos rápidos">
            <Acceso to="/admin/usuarios" icono={<Icono nombre="usuarios" tamano={22} />} titulo="Todos los usuarios" texto="Busca, suspende o reactiva cuentas" />
          </nav>
        </main>
      </div>
    );
  }

  const descripcion = cargando
    ? ""
    : futuras.length === 0
      ? esVeterinario
        ? "Todavía no tienes citas agendadas."
        : "No tienes citas próximas. ¿Buscamos un veterinario?"
      : `Tienes ${futuras.length} ${futuras.length === 1 ? "cita próxima" : "citas próximas"}${
          porConfirmar > 0 ? ` y ${porConfirmar} por confirmar` : ""
        }.`;

  return (
    <div className="pagina">
      <Cabecera />

      <main className="contenedor contenedor-ancho inicio">
        <Saludo usuario={usuario} descripcion={descripcion}>
          {esVeterinario ? (
            <Link to="/citas" className="boton boton-primario boton-auto">
              <Icono nombre="calendario" tamano={18} grosor={2} />
              Ver mi agenda
            </Link>
          ) : (
            <>
              <Link to="/veterinarios" className="boton boton-primario boton-auto">
                <Icono nombre="buscar" tamano={18} grosor={2} />
                Buscar veterinario
              </Link>
              <Link to="/mascotas?nueva=1" className="boton boton-secundario boton-auto">
                <Icono nombre="mas" tamano={18} grosor={2} />
                Agregar mascota
              </Link>
            </>
          )}
        </Saludo>

        <Alerta tipo="error" mensajes={errores} onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined} />

        {cargando && <EsqueletoCita />}

        {!cargando && siguiente && <ProximaCita cita={siguiente} esVeterinario={esVeterinario} />}

        {!cargando && !siguiente && errores.length === 0 && (
          <section className="tarjeta estado-vacio">
            <span className="estado-vacio-icono">
              <Icono nombre="calendario" tamano={28} />
            </span>
            <div>
              <h2>{esVeterinario ? "Tu agenda está libre" : "Aún no tienes citas"}</h2>
              <p className="texto-suave">
                {esVeterinario
                  ? "Cuando un cliente agende contigo, la verás aquí."
                  : "Busca un veterinario cerca de ti, compara precios y agenda en pocos pasos."}
              </p>
              {!esVeterinario && (
                <Link to="/veterinarios" className="boton boton-primario boton-auto">
                  Buscar veterinario
                </Link>
              )}
            </div>
          </section>
        )}

        <nav className="accesos" aria-label="Accesos rápidos">
          {esVeterinario ? (
            <>
              <Acceso to="/citas" icono={<Icono nombre="calendario" tamano={22} />} titulo="Mi agenda" texto="Confirma y reprograma tus citas" />
              <Acceso to="/mis-servicios" icono={<Icono nombre="lista" tamano={22} />} tono="tono-arena" titulo="Mis servicios" texto="Precios y duración de cada consulta" />
              <Acceso to="/mi-horario" icono={<Icono nombre="reloj" tamano={22} />} tono="tono-cielo" titulo="Mi horario" texto="Días y horas en que atiendes" />
            </>
          ) : (
            <>
              <Acceso to="/veterinarios" icono={<Icono nombre="estetoscopio" tamano={22} />} titulo="Buscar veterinario" texto="Compara precios, opiniones y turnos" />
              <Acceso to="/mascotas" icono={<Huella tamano={22} color="currentColor" cruz={null} />} tono="tono-arena" titulo="Mis mascotas" texto="Registra y actualiza sus datos" />
              <Acceso to="/citas" icono={<Icono nombre="calendario" tamano={22} />} tono="tono-cielo" titulo="Mis citas" texto="Próximas, pasadas y calificaciones" />
            </>
          )}
        </nav>

        <div className="inicio-columnas">
          <section className="tarjeta inicio-principal">
            <div className="encabezado-seccion">
              <h3>{esVeterinario ? "Siguientes en tu agenda" : "Siguientes citas"}</h3>
              {futuras.length > 1 && (
                <Link to="/citas" className="enlace-seccion">
                  Ver todas ({futuras.length})
                </Link>
              )}
            </div>

            {cargando && (
              <div className="lista-citas" aria-hidden="true">
                <div className="esqueleto" style={{ height: 88 }} />
                <div className="esqueleto" style={{ height: 88 }} />
              </div>
            )}

            {!cargando && resto.length === 0 && (
              <p className="texto-suave">
                {siguiente ? "No hay más citas después de la próxima." : "Aquí aparecerán tus citas agendadas."}
              </p>
            )}

            <div className="lista-citas">
              {resto.map((cita) => (
                <CitaTarjeta key={cita.id} cita={cita} perspectiva={esVeterinario ? "veterinario" : "cliente"} />
              ))}
            </div>
          </section>

          <aside className="inicio-lateral">
            <Notificaciones />

            {!esVeterinario && <MisMascotasResumen />}

            {/* Resumen del perfil profesional del veterinario */}
            {esVeterinario && usuario?.vetProfile && (
              <section className="tarjeta tarjeta-lateral">
                <div className="encabezado-seccion">
                  <h3>Mi perfil profesional</h3>
                  <Link to="/mi-perfil" className="enlace-seccion">
                    Editar
                  </Link>
                </div>
                <dl className="datos datos-apilados">
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
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
