// Listado de citas. El cliente ve las que agendó y el veterinario
// ve la agenda de las citas que le agendaron a él.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import CitaTarjeta from "../components/CitaTarjeta";
import { obtenerUsuario } from "../services/auth.service";
import { listarMisCitas } from "../services/appointment.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

function MisCitas() {
  const usuario = obtenerUsuario();
  const esVeterinario = usuario?.role === "VETERINARIAN";

  const [citas, setCitas] = useState([]);
  const [errores, setErrores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sinConexion, setSinConexion] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setErrores([]);
      setSinConexion(false);
      try {
        setCitas(await listarMisCitas());
      } catch (error) {
        setErrores(obtenerMensajesDeError(error));
        setSinConexion(esErrorDeConexion(error));
      } finally {
        setCargando(false);
      }
    }

    cargar();
  }, [intento]);

  return (
    <div className="pagina">
      <Cabecera />

      <main className="contenedor">
        <div className="tarjeta">
          <h1>{esVeterinario ? "Mi agenda" : "Mis citas"}</h1>
          <p className="texto-suave">
            {esVeterinario
              ? "Citas que tus clientes agendaron contigo, de la más próxima a la más lejana."
              : "Tus citas agendadas, de la más próxima a la más lejana."}
          </p>
        </div>

        <Alerta tipo="error" mensajes={errores} onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined} />

        {cargando && <p className="texto-suave">Cargando citas...</p>}

        {!cargando && citas.length === 0 && errores.length === 0 && (
          <div className="tarjeta">
            <p className="texto-suave">
              {esVeterinario
                ? "Todavía no tienes citas agendadas."
                : "Aún no tienes citas agendadas."}
            </p>

            {!esVeterinario && (
              <Link to="/veterinarios" className="boton boton-primario boton-auto">
                Buscar veterinario
              </Link>
            )}
          </div>
        )}

        {citas.length > 0 && (
          <div className="tarjeta">
            <div className="lista-citas">
              {citas.map((cita) => (
                <CitaTarjeta
                  key={cita.id}
                  cita={cita}
                  perspectiva={esVeterinario ? "veterinario" : "cliente"}
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
