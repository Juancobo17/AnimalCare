// AN-26: perfil detallado del veterinario con sus servicios y su horario.
// Desde aquí se pasa a agendar la cita.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import FotoVeterinario from "../components/FotoVeterinario";
import Calificacion from "../components/Calificacion";
import { obtenerVeterinario, formatearPrecio, MODALIDADES, DIAS_SEMANA } from "../services/vet.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

// Agrupa las franjas horarias por dia para mostrarlas como
// "Lunes: 09:00 - 13:00, 14:00 - 18:00".
function agruparHorario(availabilities) {
  const porDia = new Map();

  for (const franja of availabilities) {
    const actuales = porDia.get(franja.weekday) || [];
    actuales.push(`${franja.startTime} - ${franja.endTime}`);
    porDia.set(franja.weekday, actuales);
  }

  return [...porDia.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dia, franjas]) => ({ dia: DIAS_SEMANA[dia], franjas }));
}

function VeterinarioDetalle() {
  const { id } = useParams();

  const [veterinario, setVeterinario] = useState(null);
  const [errores, setErrores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sinConexion, setSinConexion] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      try {
        setVeterinario(await obtenerVeterinario(id));
        setErrores([]);
        setSinConexion(false);
      } catch (error) {
        setErrores(obtenerMensajesDeError(error));
        setSinConexion(esErrorDeConexion(error));
      } finally {
        setCargando(false);
      }
    }

    cargar();
  }, [id, intento]);

  const horario = veterinario ? agruparHorario(veterinario.availabilities) : [];

  return (
    <div className="pagina">
      <Cabecera />

      <main className="contenedor">
        <Link to="/veterinarios" className="enlace-volver">
          ← Volver a veterinarios
        </Link>

        <Alerta tipo="error" mensajes={errores} onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined} />

        {cargando && <p className="texto-suave">Cargando perfil...</p>}

        {veterinario && (
          <>
            <div className="tarjeta">
              <div className="encabezado-seccion">
                <div className="vet-cabecera">
                  <FotoVeterinario nombre={veterinario.name} url={veterinario.photoUrl} tamano={88} />
                  <div>
                    <h1>{veterinario.name}</h1>
                    <p className="texto-suave">{veterinario.specialty}</p>
                    <Calificacion valor={veterinario.rating} total={veterinario.reviewsCount} />
                  </div>
                </div>

                <Link
                  to={`/veterinarios/${veterinario.id}/agendar`}
                  className="boton boton-primario boton-auto"
                >
                  Agendar cita
                </Link>
              </div>

              <div className="etiquetas">
                {veterinario.clinicService && (
                  <span className="etiqueta etiqueta-modalidad">{MODALIDADES.CLINIC}</span>
                )}
                {veterinario.homeService && (
                  <span className="etiqueta etiqueta-modalidad">{MODALIDADES.HOME}</span>
                )}
              </div>

              {veterinario.bio && <p className="texto-presentacion">{veterinario.bio}</p>}

              <dl className="datos">
                <div>
                  <dt>Matrícula</dt>
                  <dd>{veterinario.license}</dd>
                </div>
                <div>
                  <dt>Correo</dt>
                  <dd>{veterinario.email}</dd>
                </div>
                {veterinario.phone && (
                  <div>
                    <dt>Teléfono</dt>
                    <dd>{veterinario.phone}</dd>
                  </div>
                )}
                {veterinario.address && (
                  <div>
                    <dt>Dirección</dt>
                    <dd>{veterinario.address}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="tarjeta">
              <h3>Servicios</h3>

              {veterinario.services.length === 0 ? (
                <p className="texto-suave">
                  Este profesional aún no ha publicado sus tarifas. Puedes agendar una consulta
                  general.
                </p>
              ) : (
                <ul className="lista-servicios">
                  {veterinario.services.map((servicio) => (
                    <li key={servicio.id}>
                      <div>
                        <strong>{servicio.name}</strong>
                        <span className="texto-suave"> · {servicio.durationMinutes} min</span>
                        {servicio.description && (
                          <p className="texto-suave">{servicio.description}</p>
                        )}
                      </div>
                      <span className="precio">{formatearPrecio(servicio.price)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Ubicacion del consultorio en un mapa (sin clave de API). */}
            {veterinario.clinicService && veterinario.address && (
              <div className="tarjeta">
                <h3>Cómo llegar</h3>
                <p className="texto-suave">📍 {veterinario.address}</p>
                <iframe
                  className="mapa"
                  title={`Mapa: ${veterinario.address}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(veterinario.address)}&output=embed`}
                />
                <a
                  className="enlace-seccion"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(veterinario.address)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir en Google Maps
                </a>
              </div>
            )}

            <div className="tarjeta">
              <h3>Opiniones {veterinario.reviewsCount > 0 && `(${veterinario.reviewsCount})`}</h3>
              {veterinario.reviews.length === 0 ? (
                <p className="texto-suave">
                  Todavía no tiene opiniones. Los dueños pueden calificar después de una cita atendida.
                </p>
              ) : (
                <ul className="lista-resenas">
                  {veterinario.reviews.map((r, i) => (
                    <li key={i}>
                      <div className="resena-cabecera">
                        <span className="calificacion-estrellas" aria-label={`${r.rating} de 5`}>
                          {"★".repeat(r.rating)}
                          {"☆".repeat(5 - r.rating)}
                        </span>
                        <strong>{r.author}</strong>
                        <span className="texto-suave">
                          {new Date(r.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {r.comment && <p>{r.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="tarjeta">
              <h3>Horario de atención</h3>

              {horario.length === 0 ? (
                <p className="texto-suave">Este veterinario no tiene horarios publicados.</p>
              ) : (
                <ul className="lista-horario">
                  {horario.map((dia) => (
                    <li key={dia.dia}>
                      <span className="dia">{dia.dia}</span>
                      <span className="texto-suave">{dia.franjas.join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default VeterinarioDetalle;
