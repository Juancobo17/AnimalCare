// Fila de cinco estrellas SVG (llenas hasta el valor redondeado).
// Es decorativa: quien la usa debe incluir el valor en texto o en un aria-label.
import { Star } from "lucide-react";

function Estrellas({ valor, tamano = 16 }) {
  const redondeado = Math.round(valor);

  return (
    <span className="estrellas-fila" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={tamano}
          strokeWidth={1.8}
          className={n <= redondeado ? "estrella-svg estrella-svg-llena" : "estrella-svg"}
        />
      ))}
    </span>
  );
}

export default Estrellas;
