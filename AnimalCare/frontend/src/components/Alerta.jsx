// Muestra mensajes de error o de exito.
// mensajes: arreglo de textos. tipo: "error" o "exito".
// onReintentar (opcional): si se envia, se muestra el boton "Reintentar".
//
// Los mensajes de EXITO se muestran como toast (aviso emergente que se va solo).
// Los de error se quedan en la pagina, porque explican que hay que corregir.
// fijo: deja un mensaje de exito dentro de la pagina, para los casos en que el
// mensaje ES el contenido de la pantalla (por ejemplo, "revisa tu correo").
// Sin ToastProvider (por ejemplo en pruebas aisladas) tambien se muestra dentro de la pagina.
import { useContext, useEffect } from "react";

import { ContextoToast } from "./ToastProvider";

function Alerta({ tipo = "error", mensajes = [], onReintentar, fijo = false }) {
  const toast = useContext(ContextoToast);
  const comoToast = tipo === "exito" && !fijo && Boolean(toast);
  const mostrar = toast?.mostrar;

  // Se dispara cada vez que la pagina entrega una lista de mensajes nueva.
  useEffect(() => {
    if (!comoToast || !mensajes || mensajes.length === 0) return;
    mensajes.forEach((texto) => mostrar(texto, "exito"));
  }, [comoToast, mensajes, mostrar]);

  if (comoToast || !mensajes || mensajes.length === 0) {
    return null;
  }

  const clase = tipo === "exito" ? "alerta alerta-exito" : "alerta alerta-error";

  return (
    <div className={clase} role="alert">
      {mensajes.length === 1 ? (
        <span>{mensajes[0]}</span>
      ) : (
        <>
          <strong>Revisa los siguientes datos:</strong>
          <ul>
            {mensajes.map((mensaje) => (
              <li key={mensaje}>{mensaje}</li>
            ))}
          </ul>
        </>
      )}

      {onReintentar && (
        <button type="button" className="boton boton-secundario boton-auto alerta-reintentar" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export default Alerta;
