// Foto de perfil del veterinario. Si no tiene foto (o no carga), muestra sus iniciales.
import { useState } from "react";

function obtenerIniciales(nombre = "") {
  const palabras = nombre
    .replace(/^(dr|dra)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  return palabras
    .slice(0, 2)
    .map((palabra) => palabra[0].toUpperCase())
    .join("");
}

function FotoVeterinario({ nombre, url, tamano = 64 }) {
  const [fallo, setFallo] = useState(false);
  const estilo = { width: tamano, height: tamano, fontSize: tamano * 0.38 };

  if (url && !fallo) {
    return (
      <img
        className="foto-vet"
        style={estilo}
        src={url}
        alt={`Foto de ${nombre}`}
        onError={() => setFallo(true)}
      />
    );
  }

  return (
    <span className="foto-vet foto-vet-iniciales" style={estilo} role="img" aria-label={`Sin foto de ${nombre}`}>
      {obtenerIniciales(nombre) || "?"}
    </span>
  );
}

export default FotoVeterinario;
