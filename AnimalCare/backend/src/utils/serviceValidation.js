// Validacion de un servicio que el veterinario agrega o edita desde su panel
// (AN-28 agregar, AN-30 asignar y modificar precios).
const { MIN_DURATION_MINUTES, MAX_DURATION_MINUTES } = require("./schedule");

const MAX_SERVICE_NAME_LENGTH = 60;
const MAX_SERVICE_DESCRIPTION_LENGTH = 300;
const MAX_SERVICE_PRICE = 999999.99;

const MENSAJE_OBLIGATORIOS = "Todos los campos son obligatorios: nombre, precio y duración.";
const MENSAJE_PRECIO = "El precio solo admite valores numéricos mayores a cero.";

function texto(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

// Devuelve { errors, value }. value solo es valido si errors esta vacio.
function validateServiceInput(body = {}) {
  const errors = [];

  const nombre = texto(body.name);
  const precioTexto = texto(body.price);
  const duracionTexto = texto(body.durationMinutes);
  const descripcion = texto(body.description);

  // AN-28 criterio 3: con un campo obligatorio vacio se bloquea el guardado.
  if (nombre === "" || precioTexto === "" || duracionTexto === "") {
    errors.push(MENSAJE_OBLIGATORIOS);
  }

  if (nombre.length > MAX_SERVICE_NAME_LENGTH) {
    errors.push(`El nombre del servicio no puede superar los ${MAX_SERVICE_NAME_LENGTH} caracteres.`);
  }

  // AN-30 criterio 3: ni letras, ni simbolos, ni negativos, ni cero.
  // Se exige un numero simple (ej. 50000 o 50000.50); "5e4", "$50" o "-1" no pasan.
  let precio = null;
  if (precioTexto !== "") {
    if (!/^\d+(\.\d{1,2})?$/.test(precioTexto) || Number(precioTexto) <= 0) {
      errors.push(MENSAJE_PRECIO);
    } else if (Number(precioTexto) > MAX_SERVICE_PRICE) {
      errors.push("El precio del servicio es demasiado alto.");
    } else {
      precio = Number(precioTexto);
    }
  }

  let duracion = null;
  if (duracionTexto !== "") {
    const valor = Number(duracionTexto);
    if (!/^\d+$/.test(duracionTexto)) {
      errors.push("La duración debe ser un número entero de minutos.");
    } else if (valor < MIN_DURATION_MINUTES || valor > MAX_DURATION_MINUTES) {
      errors.push(
        `La duración debe estar entre ${MIN_DURATION_MINUTES} y ${MAX_DURATION_MINUTES} minutos.`
      );
    } else if (valor % MIN_DURATION_MINUTES !== 0) {
      errors.push(`La duración debe ser múltiplo de ${MIN_DURATION_MINUTES} minutos.`);
    } else {
      duracion = valor;
    }
  }

  if (descripcion.length > MAX_SERVICE_DESCRIPTION_LENGTH) {
    errors.push(
      `La descripción no puede superar los ${MAX_SERVICE_DESCRIPTION_LENGTH} caracteres.`
    );
  }

  return {
    errors,
    value: {
      name: nombre,
      description: descripcion === "" ? null : descripcion,
      price: precio,
      durationMinutes: duracion,
    },
  };
}

module.exports = { validateServiceInput, MENSAJE_OBLIGATORIOS, MENSAJE_PRECIO };
