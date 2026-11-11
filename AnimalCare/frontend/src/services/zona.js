// Zona horaria de la clinica. Debe coincidir con CLINIC_TIMEZONE del backend.
//
// Las fechas ("AAAA-MM-DD") y horas ("HH:MM") que viajan con la API son hora
// de pared de la clinica. Aqui se convierten a instantes y se calcula "hoy"
// con esa zona, sin importar la zona del navegador.
export const ZONA_HORARIA = import.meta.env.VITE_CLINIC_TIMEZONE || "America/Bogota";

const formateador = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_HORARIA,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function partes(instante) {
  const p = {};
  for (const parte of formateador.formatToParts(instante)) p[parte.type] = parte.value;
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute };
}

function desfaseMs(instante) {
  const p = partes(instante);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(instante.getTime() / 60000) * 60000;
}

// Instante que corresponde a una hora de pared de la clinica.
export function instanteDe(fechaTexto, horaTexto = "00:00") {
  const [y, m, d] = fechaTexto.split("-").map(Number);
  const [hh, mm] = horaTexto.split(":").map(Number);
  let aproximado = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i += 1) {
    aproximado = Date.UTC(y, m - 1, d, hh, mm) - desfaseMs(new Date(aproximado));
  }
  return new Date(aproximado);
}

const pad = (n) => String(n).padStart(2, "0");

// "AAAA-MM-DD" de un instante, en la clinica.
export function fechaLocal(instante = new Date()) {
  const p = partes(instante);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

// Fecha de hoy "AAAA-MM-DD" en la clinica.
export function hoyLocal() {
  return fechaLocal(new Date());
}

// Suma dias a una fecha "AAAA-MM-DD".
export function sumarDias(fecha, dias) {
  const [y, m, d] = fecha.split("-").map(Number);
  const valor = new Date(Date.UTC(y, m - 1, d + dias));
  return valor.toISOString().slice(0, 10);
}
