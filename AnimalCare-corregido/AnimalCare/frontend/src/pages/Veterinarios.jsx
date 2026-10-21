// Listado de veterinarios. Es la puerta de entrada a AN-26:
// desde aquí se abre el perfil detallado de cada profesional.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import FotoVeterinario from "../components/FotoVeterinario";
import Calificacion from "../components/Calificacion";
import { listarVeterinarios, MODALIDADES } from "../services/vet.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

function Veterinarios() {
  const [veterinarios, setVeterinarios] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [errores, setErrores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sinConexion, setSinConexion] = useState(false);
  const [intento, setIntento] = useState(0);

  // Se vuelve a consultar cada vez que cambia un filtro.
  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      try {
        const resultado = await listarVeterinarios({
          specialty: busqueda.trim(),
          mode: modalidad,
        });
        if (!cancelado) {
          setVeterinarios(resultado);
          setErrores([]);
          setSinConexion(false);
        }
      } catch (error) {
        if (!cancelado) {
          setErrores(obtenerMensajesDeError(error));
          setSinConexion(esErrorDeConexion(error));
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    }

    // Pequeña espera para no consultar en cada tecla.
    const temporizador = setTimeout(cargar, 300);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [busqueda, modalidad, intento]);

  return (
    <div className="pagina">
      <Cabecera />

      <main className="contenedor">
        <div className="tarjeta">
          <h1>Veterinarios</h1>
          <p className="texto-suave">
            Busca por especialidad o filtra por la modalidad de atención que prefieras.
          </p>

          <div className="filtros">
            <div className="campo">
              <label htmlFor="busqueda">Especialidad</label>
              <input
                id="busqueda"
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Medicina general, cirugía..."
              />
            </div>

            <div className="campo">
              <label htmlFor="modalidad">Modalidad</label>
              <select
                id="modalidad"
                value={modalidad}
                onChange={(evento) => setModalidad(evento.target.value)}
              >
                <option value="">Todas</option>
                <option value="CLINIC">{MODALIDADES.CLINIC}</option>
                <option value="HOME">{MODALIDADES.HOME}</option>
              </select>
            </div>
          </div>
        </div>

        <Alerta tipo="error" mensajes={errores} onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined} />

        {cargando && <p className="texto-suave">Buscando veterinarios...</p>}

        {!cargando && veterinarios.length === 0 && errores.length === 0 && (
          <div className="tarjeta">
            <p className="texto-suave">
              No encontramos veterinarios con esos filtros. Prueba con otra búsqueda.
            </p>
          </div>
        )}

        <div className="lista-veterinarios">
          {veterinarios.map((veterinario) => (
            <article className="tarjeta tarjeta-veterinario" key={veterinario.id}>
              <FotoVeterinario nombre={veterinario.name} url={veterinario.photoUrl} tamano={56} />
              <div className="vet-info">
                <h3>{veterinario.name}</h3>
                <p className="texto-suave">{veterinario.specialty}</p>
                <Calificacion valor={veterinario.rating} />

                <div className="etiquetas">
                   <span className="etiqueta etiqueta-pending">Pendiente de verificación</span>
                  {veterinario.clinicService && (
                    <span className="etiqueta etiqueta-modalidad">{MODALIDADES.CLINIC}</span>
                  )}
                  {veterinario.homeService && (
                    <span className="etiqueta etiqueta-modalidad">{MODALIDADES.HOME}</span>
                  )}
                </div>

                <p className="texto-suave">
                  {veterinario.totalServices === 0
                    ? "Sin servicios publicados"
                    : `${veterinario.totalServices} servicio(s) disponibles`}
                </p>
              </div>

              <Link
                to={`/veterinarios/${veterinario.id}`}
                className="boton boton-secundario boton-auto"
              >
                Ver perfil
              </Link>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

export default Veterinarios;
