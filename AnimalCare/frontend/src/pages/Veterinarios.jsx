// Listado de veterinarios con búsqueda (AN-27), filtros y orden.
// Cada tarjeta muestra el próximo turno libre para no tener que abrir
// perfil por perfil. Desde aquí se abre el perfil detallado (AN-26).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Selector from "../components/Selector";
import { usarTitulo } from "../hooks/usarTitulo";
import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import FotoVeterinario from "../components/FotoVeterinario";
import Calificacion from "../components/Calificacion";
import Icono from "../components/Icono";
import { listarVeterinarios, formatearPrecio, describirTurno, MODALIDADES } from "../services/vet.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

const PRECIOS = [
  { valor: "", texto: "Cualquier precio" },
  { valor: "50000", texto: "Hasta $50.000" },
  { valor: "100000", texto: "Hasta $100.000" },
  { valor: "200000", texto: "Hasta $200.000" },
];

const ORDENES = [
  { valor: "next", texto: "Próximo turno" },
  { valor: "price", texto: "Menor precio" },
  { valor: "rating", texto: "Mejor calificados" },
];

function Veterinarios() {
  usarTitulo("Veterinarios");
  const [veterinarios, setVeterinarios] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [zona, setZona] = useState("");
  const [precioMaximo, setPrecioMaximo] = useState("");
  const [atiendeHoy, setAtiendeHoy] = useState(false);
  const [orden, setOrden] = useState("next");
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
          q: busqueda.trim(),
          mode: modalidad,
          zone: zona.trim(),
          maxPrice: precioMaximo,
          today: atiendeHoy,
          sort: orden,
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
  }, [busqueda, modalidad, zona, precioMaximo, atiendeHoy, orden, intento]);

  const hayFiltros = busqueda || modalidad || zona || precioMaximo || atiendeHoy;

  function limpiarFiltros() {
    setBusqueda("");
    setModalidad("");
    setZona("");
    setPrecioMaximo("");
    setAtiendeHoy(false);
  }

  return (
    <div className="pagina">
      <Cabecera />

      <main className="contenedor">
        <div className="tarjeta">
          <h1>Veterinarios</h1>
          <p className="texto-suave">
            Busca por nombre, especialidad o servicio y filtra por modalidad, zona o precio.
          </p>

          <div className="filtros-panel">
            <div className="campo campo-busqueda">
              <label htmlFor="busqueda">Buscar</label>
              <div className="entrada-icono">
                <Icono nombre="buscar" tamano={18} grosor={2} />
                <input
                  id="busqueda"
                  type="search"
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Nombre, especialidad o servicio"
                  maxLength={60}
                />
              </div>
            </div>

            <div className="filtros-fila">
              <div className="campo">
                <label htmlFor="modalidad">Modalidad</label>
                <Selector id="modalidad" value={modalidad} onChange={(evento) => setModalidad(evento.target.value)}>
                  <option value="">Todas</option>
                  <option value="CLINIC">{MODALIDADES.CLINIC}</option>
                  <option value="HOME">{MODALIDADES.HOME}</option>
                </Selector>
              </div>

              <div className="campo">
                <label htmlFor="zona">Zona o barrio</label>
                <div className="entrada-icono">
                  <Icono nombre="ubicacion" tamano={18} grosor={2} />
                  <input
                    id="zona"
                    type="search"
                    value={zona}
                    onChange={(e) => setZona(e.target.value)}
                    placeholder="Centro, Popayán..."
                    maxLength={60}
                  />
                </div>
              </div>

              <div className="campo">
                <label htmlFor="precio">Precio</label>
                <Selector id="precio" value={precioMaximo} onChange={(e) => setPrecioMaximo(e.target.value)}>
                  {PRECIOS.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.texto}
                    </option>
                  ))}
                </Selector>
              </div>

              <div className="campo">
                <label htmlFor="orden">Ordenar por</label>
                <Selector id="orden" value={orden} onChange={(e) => setOrden(e.target.value)}>
                  {ORDENES.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.texto}
                    </option>
                  ))}
                </Selector>
              </div>
            </div>

            <div className="filtros-pie">
              <label className="chip-filtro">
                <input type="checkbox" checked={atiendeHoy} onChange={(e) => setAtiendeHoy(e.target.checked)} />
                <Icono nombre="reloj" tamano={16} grosor={2} />
                Con turnos hoy
              </label>
              {hayFiltros && (
                <button type="button" className="enlace-accion" onClick={limpiarFiltros}>
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        </div>

        <Alerta tipo="error" mensajes={errores} onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined} />

        {cargando && <p className="texto-suave">Buscando veterinarios...</p>}

        {!cargando && veterinarios.length === 0 && errores.length === 0 && (
          <div className="tarjeta">
            <p className="texto-suave">
              No encontramos veterinarios con esta especialidad o modalidad, intenta con otra búsqueda
            </p>
          </div>
        )}

        {!cargando && veterinarios.length > 0 && (
          <p className="texto-suave resultados">
            {veterinarios.length} {veterinarios.length === 1 ? "veterinario" : "veterinarios"}
          </p>
        )}

        <div className="lista-veterinarios">
          {veterinarios.map((veterinario) => (
            <article className="tarjeta tarjeta-veterinario" key={veterinario.id}>
              <div className="vet-cabeza">
                <FotoVeterinario nombre={veterinario.name} url={veterinario.photoUrl} tamano={72} />
                <div className="vet-titulo">
                  <h3>{veterinario.name}</h3>
                  <p className="vet-especialidad">{veterinario.specialty}</p>
                  <Calificacion valor={veterinario.rating} total={veterinario.reviewsCount} />
                </div>
                <span className="insignia-verificado" title="Matrícula profesional revisada por AnimalCare">
                  <Icono nombre="escudo" tamano={14} grosor={2.2} />
                  Verificado
                </span>
              </div>

              <div className="vet-info">
                <div className="etiquetas">
                  {veterinario.clinicService && (
                    <span className="etiqueta etiqueta-modalidad">{MODALIDADES.CLINIC}</span>
                  )}
                  {veterinario.homeService && (
                    <span className="etiqueta etiqueta-modalidad">{MODALIDADES.HOME}</span>
                  )}
                </div>

                {veterinario.clinicService && veterinario.address && (
                  <p className="vet-dato">
                    <Icono nombre="ubicacion" tamano={16} grosor={2} />
                    {veterinario.address}
                  </p>
                )}
                <p className="vet-dato">
                  <Icono nombre="lista" tamano={16} grosor={2} />
                  {veterinario.totalServices === 0
                    ? "Sin servicios publicados"
                    : `${veterinario.totalServices} ${veterinario.totalServices === 1 ? "servicio" : "servicios"}`}
                </p>
              </div>

              <div className="vet-pie">
                <div className="vet-precio">
                  {veterinario.minPrice !== null ? (
                    <>
                      <span>Desde</span>
                      <strong>{formatearPrecio(veterinario.minPrice)}</strong>
                    </>
                  ) : (
                    <span>Precio por consultar</span>
                  )}
                </div>

                <div className="vet-turno">
                  <Icono nombre="reloj" tamano={16} grosor={2} />
                  {veterinario.nextSlot ? (
                    <span>
                      <span className="texto-suave">Próximo turno</span>
                      <strong>{describirTurno(veterinario.nextSlot)}</strong>
                    </span>
                  ) : (
                    <span className="texto-suave">Sin turnos en 14 días</span>
                  )}
                </div>

                <div className="vet-botones">
                  <Link to={`/veterinarios/${veterinario.id}`} className="boton boton-secundario boton-auto">
                    Ver perfil
                  </Link>
                  {veterinario.nextSlot && (
                    <Link to={`/veterinarios/${veterinario.id}/agendar`} className="boton boton-primario boton-auto">
                      Agendar
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

export default Veterinarios;
