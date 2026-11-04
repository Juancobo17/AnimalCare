// Muestra mensajes de error o de exito.
// mensajes: arreglo de textos. tipo: "error" o "exito".
// onReintentar (opcional): si se envia, se muestra el boton "Reintentar".
function Alerta({ tipo = "error", mensajes = [], onReintentar }) {
  if (!mensajes || mensajes.length === 0) {
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
