// Calificacion promedio del veterinario (0 a 5). null = aun sin calificaciones.
// total (opcional) es la cantidad de opiniones.
import Estrellas from "./Estrellas";

function Calificacion({ valor, total }) {
  if (valor === null || valor === undefined) {
    return <span className="calificacion calificacion-vacia">Sin calificaciones aún</span>;
  }

  return (
    <span className="calificacion" title={`${valor.toFixed(1)} de 5`}>
      <Estrellas valor={valor} />
      <strong>{valor.toFixed(1)}</strong>
      <span className="texto-suave">
        {" "}
        / 5{total ? ` · ${total} ${total === 1 ? "opinión" : "opiniones"}` : ""}
      </span>
    </span>
  );
}

export default Calificacion;
