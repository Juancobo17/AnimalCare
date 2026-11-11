// Archivos que suben los usuarios: foto del veterinario (publica) y
// tarjeta profesional (privada, solo la ve el administrador).
//
// Llegan como data URL en JSON ("data:image/png;base64,...") para no sumar
// dependencias. Se validan tipo y tamano antes de escribir en disco.
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
const PHOTOS_DIR = path.join(UPLOADS_DIR, "photos"); // se sirve en /uploads/photos
const DOCS_DIR = path.join(UPLOADS_DIR, "docs"); // NO se sirve publicamente
const RECORDS_DIR = path.join(UPLOADS_DIR, "records"); // adjuntos de historias clinicas: NO publico

const TIPOS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

// Firma de los primeros bytes de cada tipo: evita aceptar un archivo que
// solo dice ser una imagen.
const FIRMAS = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8,
  "image/png": (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP",
  "application/pdf": (b) => b.slice(0, 4).toString() === "%PDF",
};

// Devuelve { error } o { buffer, mime, extension }.
function parseDataUrl(dataUrl, { tipos, maxBytes }) {
  const match = /^data:([a-z/]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl ?? ""));
  if (!match) {
    return { error: "El archivo no es válido." };
  }
  const mime = match[1];
  if (!tipos.includes(mime)) {
    return { error: `Formato no permitido. Usa: ${tipos.map((t) => TIPOS[t].toUpperCase()).join(", ")}.` };
  }
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0) {
    return { error: "El archivo está vacío." };
  }
  if (buffer.length > maxBytes) {
    return { error: `El archivo no puede pesar más de ${Math.round(maxBytes / (1024 * 1024))} MB.` };
  }
  if (!FIRMAS[mime](buffer)) {
    return { error: "El contenido del archivo no coincide con su formato." };
  }
  return { buffer, mime, extension: TIPOS[mime] };
}

async function guardar(dir, prefijo, archivo) {
  await fs.mkdir(dir, { recursive: true });
  const nombre = `${prefijo}-${crypto.randomBytes(8).toString("hex")}.${archivo.extension}`;
  await fs.writeFile(path.join(dir, nombre), archivo.buffer);
  return nombre;
}

// Borra un archivo anterior sin fallar si ya no existe.
async function borrar(rutaAbsoluta) {
  try {
    await fs.unlink(rutaAbsoluta);
  } catch {
    // Ya no estaba.
  }
}

// La foto se guarda como ruta publica relativa: "/uploads/photos/vet-7-ab12.jpg".
async function savePhoto(vetProfileId, archivo) {
  const nombre = await guardar(PHOTOS_DIR, `vet-${vetProfileId}`, archivo);
  return `/uploads/photos/${nombre}`;
}

async function deletePhoto(photoUrl) {
  if (photoUrl && photoUrl.startsWith("/uploads/photos/")) {
    await borrar(path.join(PHOTOS_DIR, path.basename(photoUrl)));
  }
}

// El documento se guarda solo con su nombre; se lee con docAbsolutePath.
async function saveDoc(vetProfileId, archivo) {
  return guardar(DOCS_DIR, `tarjeta-${vetProfileId}`, archivo);
}

function docAbsolutePath(nombre) {
  // basename evita que un valor manipulado salga de la carpeta.
  return path.join(DOCS_DIR, path.basename(nombre));
}

async function deleteDoc(nombre) {
  if (nombre) {
    await borrar(docAbsolutePath(nombre));
  }
}

// Adjuntos de la historia clinica: se guardan con nombre aleatorio y solo se
// entregan por la API, verificando sesion y permiso.
async function saveRecordFile(archivo) {
  return guardar(RECORDS_DIR, "adjunto", archivo);
}

function recordFileAbsolutePath(nombre) {
  return path.join(RECORDS_DIR, path.basename(nombre));
}

async function deleteRecordFile(nombre) {
  if (nombre) {
    await borrar(recordFileAbsolutePath(nombre));
  }
}

// Nombre de archivo seguro para mostrar y para la cabecera de descarga:
// sin rutas, sin caracteres de control y de largo acotado.
function cleanFileName(value, extension) {
  let nombre = String(value ?? "").split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "").trim();
  if (nombre === "" || nombre === "." || nombre === "..") {
    nombre = `adjunto.${extension}`;
  }
  if (nombre.length > 100) {
    const punto = nombre.lastIndexOf(".");
    const ext = punto > 0 ? nombre.slice(punto) : "";
    nombre = nombre.slice(0, 100 - ext.length) + ext;
  }
  return nombre;
}

module.exports = {
  UPLOADS_DIR,
  PHOTOS_DIR,
  parseDataUrl,
  savePhoto,
  deletePhoto,
  saveDoc,
  docAbsolutePath,
  deleteDoc,
  saveRecordFile,
  recordFileAbsolutePath,
  deleteRecordFile,
  cleanFileName,
};
