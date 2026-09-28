// Utilidades para leer parametros de la URL.

// Convierte un :id de la URL en numero.
// Devuelve null si no es un entero positivo, para responder 400 sin consultar
// la base de datos con un valor invalido.
function parseId(value) {
  if (!/^\d+$/.test(String(value))) {
    return null;
  }
  const number = Number(value);
  return number > 0 ? number : null;
}

module.exports = { parseId };
