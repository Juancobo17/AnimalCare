// Ejecuta una funcion al montar y luego cada cierto tiempo (por ejemplo, para
// refrescar el estado de una urgencia sin que la persona recargue la pagina).
// La funcion mas reciente es la que se llama; se detiene al desmontar.
import { useEffect, useRef } from "react";

export function useSondeo(funcion, intervaloMs, activo = true) {
  const ultima = useRef(funcion);

  useEffect(() => {
    ultima.current = funcion;
  });

  useEffect(() => {
    if (!activo) return undefined;
    ultima.current();
    const temporizador = setInterval(() => ultima.current(), intervaloMs);
    return () => clearInterval(temporizador);
  }, [intervaloMs, activo]);
}
