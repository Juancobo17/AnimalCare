// Listado de citas.
// Cliente: "Mis citas", con pestañas de próximas e historial y cancelación (AN-14).
// Veterinario: "Mi agenda" de un día concreto con filtro por estado (AN-17)
// y acciones de confirmar, reprogramar y cancelar (AN-15, AN-16).
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import CitaTarjeta from "../components/CitaTarjeta";
import Icono from "../components/Icono";
import { usarTitulo } from "../hooks/usarTitulo";
import { obtenerUsuario } from "../services/auth.service";
import {
  listarMisCitas,
  esActiva,
  inicioDeCita,
  formatearFecha,
  hoyLocal,
  sumarDias,
} from "../services/appointment.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

// Filtros de estado de la agenda del veterinario.
const FILTROS_AGENDA = [
  { valor: "ACTIVAS", texto: "Pendientes y en atención", cumple: (c) => esActiva(c) || c.status === "IN_PROGRESS" },
  { valor: "PENDING", texto: "Pendientes", cumple: (c) => c.status === "PENDING" },
  { valor: "TODAS", texto: "Todas", cumple: () => true },
];

// Titulo de cada grupo: "Hoy", "Mañana" o "jueves, 20 de noviembre".
function etiquetaDelDia(fecha) {
  const hoy = hoyLocal();
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDias(hoy, 1)) return "Mañana";
  if (fecha === sumarDias(hoy, -1)) return "Ayer";
  const texto = new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: fecha.slice(0, 4) === hoy.slice(0, 4) ? undefined : "numeric",
    timeZone: "UTC",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Agrupa citas ya ordenadas por su fecha, conservando el orden recibido.
function agruparPorDia(lista) {
  const grupos = [];
  lista.forEach((cita) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.fecha === cita.date) {
      ultimo.citas.push(cita);
    } else {
      grupos.push({ fecha: cita.date, citas: [cita] });
    }
  });
  return grupos;
}

function MisCitas() {
  const usuario = obtenerUsuario();
  const esVeterinario = usuario?.role === "VETERINARIAN";
  usarTitulo(esVeterinario ? "Mi agenda" : "Mis citas");

  // Veterinario: dia consultado ("" = todas las proximas).
  const [dia, setDia] = useState(hoyLocal());
  const [filtro, setFiltro] = useState("ACTIVAS");
  // Cliente: "proximas" o "historial".
  const [pestana, setPestana] = useState("proximas");

  const [citas, setCitas] = useState([]);
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sinConexion, setSinConexion] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setErrores([]);
      setSinConexion(false);
      try {
        setCitas(await listarMisCitas(esVeterinario && dia ? { date: dia } : {}));
      } catch (error) {
        setErrores(obtenerMensajesDeError(error));
        setSinConexion(esErrorDeConexion(error));
      } finally {
        setCargando(false);
      }
    }

    cargar();
  }, [intento, dia, esVeterinario]);

  // Al confirmar, cancelar o reprogramar, la cita se reemplaza con su estado nuevo.
  function manejarActualizada(resultado) {
    setErrores([]);
    setExito([resultado.message]);
    setCitas((anteriores) => {
      const actualizadas = anteriores.map((item) =>
        item.id === resultado.appointment.id ? resultado.appointment : item
      );
      // Si se reprogramo a otro dia, deja de pertenecer al dia consultado.
      return esVeterinario && dia ? actualizadas.filter((c) => c.date === dia) : actualizadas;
    });
  }

  // Cliente: cuantas citas hay en cada pestaña (para mostrarlo en la pestaña).
  const { proximasCliente, historialCliente } = useMemo(() => {
    const ahora = Date.now();
    const esProxima = (c) => esActiva(c) && inicioDeCita(c).getTime() > ahora;
    return {
      proximasCliente: citas.filter(esProxima),
      historialCliente: citas.filter((c) => !esProxima(c)).reverse(),
    };
  }, [citas]);

  const visibles = useMemo(() => {
    if (esVeterinario) {
      const regla = FILTROS_AGENDA.find((f) => f.valor === filtro);
      const lista = citas.filter(regla.cumple);
      // Sin dia elegido se muestran solo las proximas.
      return dia ? lista : lista.filter((c) => inicioDeCita(c).getTime() > Date.now());
    }
    return pestana === "proximas" ? proximasCliente : historialCliente;
  }, [citas, esVeterinario, filtro, dia, pestana, proximasCliente, historialCliente]);

  // Un solo dia consultado no necesita titulo de grupo: ya lo dice el resumen.
  const grupos = useMemo(() => {
    if (esVeterinario && dia) return [{ fecha: dia, citas: visibles, sinTitulo: true }];
    return agruparPorDia(visibles);
  }, [visibles, esVeterinario, dia]);

  const resumen = useMemo(() => {
    const pendientes = citas.filter((c) => c.status === "PENDING").length;
    const confirmadas = citas.filter((c) => c.status === "CONFIRMED").length;
    return { pendientes, confirmadas };
  }, [citas]);

  const mensajeVacio = esVeterinario
    ? dia
      ? "No tienes citas para este día con este filtro."
      : "No tienes citas próximas con este filtro."
    : pestana === "proximas"
      ? "No tienes citas próximas."
      : "Todavía no tienes citas anteriores o canceladas.";

  const pestanasCliente = [
    { valor: "proximas", texto: "Próximas", total: proximasCliente.length },
    { valor: "historial", texto: "Historial", total: historialCliente.length },
  ];

  return (
    <div className="pagina">
      <Cabecera />

      <main className="contenedor">
        <div className="tarjeta">
          <div className="encabezado-seccion">
            <h1>{esVeterinario ? "Mi agenda" : "Mis citas"}</h1>
            {/* El cliente siempre puede agendar otra cita, tenga o no citas. */}
            {!esVeterinario && (
              <Link to="/veterinarios" className="boton boton-primario boton-auto">
                <Icono nombre="mas" tamano={18} grosor={2.4} />
                Agendar nueva cita
              </Link>
            )}
          </div>
          <p className="texto-suave">
            {esVeterinario
              ? "Revisa las citas de un día, confírmalas, reprográmalas o cancélalas."
              : "Tus citas agendadas. Puedes cancelar las próximas si lo necesitas."}
          </p>

          {esVeterinario ? (
            <>
              <div className="navegador-dia">
                <button
                  type="button"
                  className="boton boton-secundario boton-auto boton-cuadrado"
                  aria-label="Día anterior"
                  onClick={() => setDia(sumarDias(dia || hoyLocal(), -1))}
                >
                  <Icono nombre="izquierda" tamano={18} grosor={2.2} />
                </button>
                <input
                  type="date"
                  aria-label="Día de la agenda"
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                />
                <button
                  type="button"
                  className="boton boton-secundario boton-auto boton-cuadrado"
                  aria-label="Día siguiente"
                  onClick={() => setDia(sumarDias(dia || hoyLocal(), 1))}
                >
                  <Icono nombre="flecha" tamano={18} grosor={2.2} />
                </button>
                <button
                  type="button"
                  className={`boton boton-auto ${dia === hoyLocal() ? "boton-seleccionado" : "boton-secundario"}`}
                  aria-pressed={dia === hoyLocal()}
                  onClick={() => setDia(hoyLocal())}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  className={`boton boton-auto ${dia === "" ? "boton-seleccionado" : "boton-secundario"}`}
                  aria-pressed={dia === ""}
                  onClick={() => setDia("")}
                >
                  Todas las próximas
                </button>
              </div>

              <p className="resumen-dia">
                <strong>{dia ? formatearFecha(dia) : "Próximas citas"}</strong>
                <span className="texto-suave">
                  {" "}
                  · {resumen.pendientes} pendiente(s) · {resumen.confirmadas} confirmada(s)
                </span>
              </p>

              <div className="pestanas" role="tablist">
                {FILTROS_AGENDA.map((f) => (
                  <button
                    key={f.valor}
                    type="button"
                    role="tab"
                    aria-selected={filtro === f.valor}
                    className={`pestana ${filtro === f.valor ? "pestana-activa" : ""}`}
                    onClick={() => setFiltro(f.valor)}
                  >
                    {f.texto}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="pestanas" role="tablist">
              {pestanasCliente.map((p) => (
                <button
                  key={p.valor}
                  type="button"
                  role="tab"
                  aria-selected={pestana === p.valor}
                  className={`pestana ${pestana === p.valor ? "pestana-activa" : ""}`}
                  onClick={() => setPestana(p.valor)}
                >
                  {p.texto}
                  {!cargando && <span className="pestana-total">{p.total}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <Alerta tipo="exito" mensajes={exito} />
        <Alerta
          tipo="error"
          mensajes={errores}
          onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined}
        />

        {cargando && (
          <div className="lista-citas" aria-busy="true" aria-label="Cargando citas">
            <div className="esqueleto" style={{ height: 120 }} />
            <div className="esqueleto" style={{ height: 120 }} />
          </div>
        )}

        {!cargando && visibles.length === 0 && errores.length === 0 && (
          <div className="tarjeta estado-vacio">
            <span className="estado-vacio-icono">
              <Icono nombre="calendario" tamano={28} />
            </span>
            <div>
              <h2>{mensajeVacio}</h2>
              {!esVeterinario && pestana === "proximas" && (
                <>
                  <p className="texto-suave">Busca un veterinario, compara precios y agenda en pocos pasos.</p>
                  <Link to="/veterinarios" className="boton boton-primario boton-auto">
                    Buscar veterinario
                  </Link>
                </>
              )}
            </div>
          </div>
        )}

        {!cargando &&
          visibles.length > 0 &&
          grupos.map((grupo) => (
            <section key={grupo.fecha} className="grupo-citas">
              {!grupo.sinTitulo && (
                <h2 className="grupo-titulo">
                  {etiquetaDelDia(grupo.fecha)}
                  <span className="grupo-total">
                    {grupo.citas.length} {grupo.citas.length === 1 ? "cita" : "citas"}
                  </span>
                </h2>
              )}
              <div className="lista-citas">
                {grupo.citas.map((cita) => (
                  <CitaTarjeta
                    key={cita.id}
                    cita={cita}
                    perspectiva={esVeterinario ? "veterinario" : "cliente"}
                    onActualizada={manejarActualizada}
                  />
                ))}
              </div>
            </section>
          ))}
      </main>
    </div>
  );
}

export default MisCitas;
