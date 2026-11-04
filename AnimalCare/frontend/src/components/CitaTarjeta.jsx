// Tarjeta de una cita. Se usa en el panel y en el listado de citas.
//
// perspectiva indica quien la esta mirando: el cliente ve con que veterinario
// es la cita, y el veterinario ve que cliente la agendo.
import { MODALIDADES } from "../services/vet.service";
import { ESTADOS_CITA, formatearFecha } from "../services/appointment.service";

function CitaTarjeta({ cita, perspectiva = "cliente" }) {
  const esVistaDelVeterinario = perspectiva === "veterinario";

  // En atención a domicilio la dirección es la del cliente;
  // en la veterinaria, la del consultorio.
  const direccion = cita.mode === "HOME" ? cita.address : cita.vet?.address;

  return (
    <article className="cita">
      <div className="cita-fecha">
        <span className="cita-hora">{cita.time}</span>
        <span className="cita-dia">{formatearFecha(cita.date)}</span>
      </div>

      <div className="cita-datos">
        <h4>
          {esVistaDelVeterinario ? cita.client?.name : cita.vet?.name}
          {!esVistaDelVeterinario && cita.vet?.specialty && (
            <span className="texto-suave"> · {cita.vet.specialty}</span>
          )}
        </h4>

        <p className="texto-suave">
          {cita.service ? cita.service.name : "Consulta general"} · {cita.durationMinutes} min ·{" "}
          {MODALIDADES[cita.mode]}
        </p>

        {direccion && <p className="texto-suave">📍 {direccion}</p>}
        {cita.notes && <p className="cita-notas">“{cita.notes}”</p>}
      </div>

      <span className={`etiqueta etiqueta-${cita.status.toLowerCase()}`}>
        {ESTADOS_CITA[cita.status]}
      </span>
    </article>
  );
}

export default CitaTarjeta;
