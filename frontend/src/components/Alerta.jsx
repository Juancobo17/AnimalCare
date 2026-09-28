// Muestra mensajes de error o de exito.
// mensajes: arreglo de textos. tipo: "error" o "exito".
function Alerta({ tipo = "error", mensajes = [] }) {
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
    </div>
  );
}

export default Alerta;
