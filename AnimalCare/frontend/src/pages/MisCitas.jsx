// Listado de citas.
// Cliente: "Mis citas", con pestañas de próximas e historial y cancelación (AN-14).
// Veterinario: "Mi agenda" de un día concreto con filtro por estado (AN-17)
// y acciones de confirmar, reprogramar y cancelar (AN-15, AN-16).
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import CitaTarjeta from "../components/CitaTarjeta";
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
  { valor: "ACTIVAS", texto: "Pendientes y confirmadas", cumple: esActiva },
  { valor: "PENDING", texto: "Pendientes", cumple: (c) => c.status === "PENDING" },
  { valor: "TODAS", texto: "Todas", cumple: () => true },
];

function MisCitas() {
  const usuario = obtenerUsuario();
  const esVeterinario = usuario?.role === "VETERINARIAN";

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

  const visibles = useMemo(() => {
    if (esVeterinario) {
      const regla = FILTROS_AGENDA.find((f) => f.valor === filtro);
      const lista = citas.filter(regla.cumple);
      // Sin dia elegido se muestran solo las proximas.
      return dia ? lista : lista.filter((c) => inicioDeCita(c).getTime() > Date.now());
    }
    const ahora = Date.now();
    const proximas = (c) => esActiva(c) && inicioDeCita(c).getTime() > ahora;
    return pestana === "proximas"
      ? citas.filter(proximas)
      : citas.filter((c) => !proximas(c)).reverse();
  }, [citas, esVeterinario, filtro, dia, pestana]);

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

  return (
    <div className="pagina">
      <Cabecera />

      <main className="contenedor">
        <div className="tarjeta">
          <h1>{esVeterinario ? "Mi agenda" : "Mis citas"}</h1>
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
                  className="boton boton-secundario boton-auto"
                  aria-label="Día anterior"
                  onClick={() => setDia(sumarDias(dia || hoyLocal(), -1))}
                >
                  ‹
                </button>
                <input
                  type="date"
                  aria-label="Día de la agenda"
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                />
                <button
                  type="button"
                  className="boton boton-secundario boton-auto"
                  aria-label="Día siguiente"
                  onClick={() => setDia(sumarDias(dia || hoyLocal(), 1))}
                >
                  ›
                </button>
                <button type="button" className="boton boton-secundario boton-auto" onClick={() => setDia(hoyLocal())}>
                  Hoy
                </button>
                <button
                  type="button"
                  className={`boton boton-auto ${dia === "" ? "boton-primario" : "boton-secundario"}`}
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
              {[
                { valor: "proximas", texto: "Próximas" },
                { valor: "historial", texto: "Historial" },
              ].map((p) => (
                <button
                  key={p.valor}
                  type="button"
                  role="tab"
                  aria-selected={pestana === p.valor}
                  className={`pestana ${pestana === p.valor ? "pestana-activa" : ""}`}
                  onClick={() => setPestana(p.valor)}
                >
                  {p.texto}
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

        {cargando && <p className="texto-suave">Cargando citas...</p>}

        {!cargando && visibles.length === 0 && errores.length === 0 && (
          <div className="tarjeta">
            <p className="texto-suave">{mensajeVacio}</p>
            {!esVeterinario && pestana === "proximas" && (
              <Link to="/veterinarios" className="boton boton-primario boton-auto">
                Buscar veterinario
              </Link>
            )}
          </div>
        )}

        {!cargando && visibles.length > 0 && (
          <div className="tarjeta">
            <div className="lista-citas">
              {visibles.map((cita) => (
                <CitaTarjeta
                  key={cita.id}
                  cita={cita}
                  perspectiva={esVeterinario ? "veterinario" : "cliente"}
                  onActualizada={manejarActualizada}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default MisCitas;
