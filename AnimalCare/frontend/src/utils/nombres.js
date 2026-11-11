// Utilidades para mostrar nombres de personas.
//
// Los veterinarios suelen registrarse con su titulo ("Dra. Camila Rojas"). Para
// saludar o armar las iniciales no se debe tomar el titulo como si fuera el nombre.

// Quita un "Dr." o "Dra." al principio. Si el nombre es solo el titulo, lo deja igual.
export function quitarTitulo(nombre = "") {
  const sinTitulo = nombre.trim().replace(/^(dr|dra)\.?\s+/i, "");
  return sinTitulo || nombre.trim();
}

// Primer nombre para saludar: "Dra. Camila Rojas" -> "Camila".
export function primerNombreDe(nombre = "") {
  return quitarTitulo(nombre).split(/\s+/)[0] || "";
}

// Iniciales (hasta dos): "Dra. Camila Rojas" -> "CR".
export function inicialesDe(nombre = "") {
  return quitarTitulo(nombre)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0].toUpperCase())
    .join("");
}
