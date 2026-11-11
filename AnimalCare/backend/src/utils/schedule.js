// Utilidades de fecha y hora para la agenda de citas.
//
// Decision del proyecto: todas las fechas y horas "de pared" ("AAAA-MM-DD",
// "HH:MM") se interpretan en la zona horaria de la clinica (CLINIC_TIMEZONE,
// por defecto America/Bogota), sin importar donde corra el servidor ni que
// zona tenga el navegador. En la base de datos se guardan instantes (UTC).
//
// Asi, la hora que elige el cliente es exactamente la que ve el veterinario,
// y "hoy", "ya paso" o "faltan 2 horas" se calculan con la hora real de Colombia.

const CLINIC_TIMEZONE = process.env.CLINIC_TIMEZONE || "America/Bogota";

// Duracion de cada bloque de la agenda, en minutos.
const SLOT_MINUTES = 30;

// Duracion que se usa cuando la cita no tiene un servicio asociado.
const DEFAULT_DURATION_MINUTES = 30;

// Limites de duracion de un servicio. MAX_DURATION_MINUTES tambien acota
// hasta donde hay que mirar hacia atras al buscar choques de horario.
const MIN_DURATION_MINUTES = 15;
const MAX_DURATION_MINUTES = 240;

// Con cuanta anticipacion se puede consultar y agendar, en dias.
const MAX_SCHEDULE_DAYS = 60;

// ---------- Conversion entre instantes y hora de pared de la clinica ----------

const formateador = new Intl.DateTimeFormat("en-US", {
  timeZone: CLINIC_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

const DIAS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Descompone un instante en la hora de pared de la clinica.
function toLocalParts(date) {
  const partes = {};
  for (const parte of formateador.formatToParts(date)) {
    partes[parte.type] = parte.value;
  }
  return {
    year: Number(partes.year),
    month: Number(partes.month),
    day: Number(partes.day),
    hour: Number(partes.hour) % 24,
    minute: Number(partes.minute),
    second: Number(partes.second),
    weekday: DIAS[partes.weekday],
  };
}

// Diferencia (ms) entre la hora de pared de la clinica y UTC para un instante.
function offsetMs(date) {
  const p = toLocalParts(date);
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return comoUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// Instante que corresponde a una hora de pared de la clinica.
// Se itera dos veces para acertar tambien en zonas con horario de verano.
function fromLocal(year, month, day, hour = 0, minute = 0) {
  let aproximado = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 2; i += 1) {
    aproximado = Date.UTC(year, month - 1, day, hour, minute) - offsetMs(new Date(aproximado));
  }
  return new Date(aproximado);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// ---------- Fechas y horas como texto ----------

// Convierte "AAAA-MM-DD" en el inicio de ese dia en la clinica.
// Devuelve null si el formato es incorrecto o el dia no existe
// (por ejemplo 2026-02-31, que JavaScript aceptaria corriendo el mes).
function parseDate(value) {
  const text = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    return null;
  }

  const date = fromLocal(Number(match[1]), Number(match[2]), Number(match[3]));
  if (Number.isNaN(date.getTime()) || toDateString(date) !== text) {
    return null;
  }
  return date;
}

// Convierte "HH:MM" en minutos desde la medianoche. Devuelve null si no es valida.
function parseTime(value) {
  const text = String(value ?? "").trim();

  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

// Convierte minutos desde la medianoche en "HH:MM".
function toTimeString(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

// Instante de un dia (inicio de dia en la clinica) a una cantidad de minutos.
function atMinutes(dayStart, minutes) {
  const p = toLocalParts(dayStart);
  return fromLocal(p.year, p.month, p.day, Math.floor(minutes / 60), minutes % 60);
}

// Une "AAAA-MM-DD" y "HH:MM" en un unico instante.
function combine(dateText, timeText) {
  const date = parseDate(dateText);
  const minutes = parseTime(timeText);

  if (!date || minutes === null) {
    return null;
  }

  return atMinutes(date, minutes);
}

// Devuelve la parte de fecha "AAAA-MM-DD" de un instante, en la clinica.
function toDateString(date) {
  const p = toLocalParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

// Devuelve la parte de hora "HH:MM" de un instante, en la clinica.
function toTimeOfDay(date) {
  const p = toLocalParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

// Dia de la semana en la clinica (0 = domingo ... 6 = sabado).
function localWeekday(date) {
  return toLocalParts(date).weekday;
}

// Inicio del dia (en la clinica) al que pertenece un instante.
function startOfDay(date = new Date()) {
  const p = toLocalParts(date);
  return fromLocal(p.year, p.month, p.day);
}

// Inicio de dia N dias despues (o antes, si es negativo).
function addDays(dayStart, days) {
  const p = toLocalParts(dayStart);
  return fromLocal(p.year, p.month, p.day + days);
}

// Texto legible para las notificaciones: "jueves 12 de noviembre a las 09:00".
function describeDateTime(date) {
  const dia = date.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: CLINIC_TIMEZONE,
  });
  return `${dia.replace(",", "")} a las ${toTimeOfDay(date)}`;
}

// Dos rangos de tiempo se cruzan si uno empieza antes de que el otro termine.
// Un rango que empieza justo cuando el otro acaba NO se considera choque.
function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

// Calcula los horarios libres de un veterinario para un dia concreto.
//
// availabilities: franjas semanales del veterinario ({ weekday, startTime, endTime })
// date:           inicio del dia consultado (ver parseDate / startOfDay)
// durationMinutes: cuanto dura la cita que se quiere agendar
// busy:           citas y bloqueos de ese dia ({ start: Date, end: Date })
// now:            momento actual, para descartar horarios que ya pasaron
//
// Devuelve un arreglo de horas "HH:MM" ordenadas.
function buildSlots({ availabilities, date, durationMinutes, busy = [], now = new Date() }) {
  const weekday = localWeekday(date);
  const slots = [];

  // Solo interesan las franjas del dia de la semana consultado.
  const windows = availabilities.filter((item) => item.weekday === weekday);

  for (const window of windows) {
    const windowStart = parseTime(window.startTime);
    const windowEnd = parseTime(window.endTime);

    // Una franja mal cargada se ignora en vez de romper la consulta.
    if (windowStart === null || windowEnd === null || windowEnd <= windowStart) {
      continue;
    }

    // Se avanza de SLOT_MINUTES en SLOT_MINUTES; la cita debe caber completa
    // dentro de la franja, por eso el limite resta la duracion.
    for (let minute = windowStart; minute + durationMinutes <= windowEnd; minute += SLOT_MINUTES) {
      const start = atMinutes(date, minute);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      // Un horario que ya paso no se ofrece.
      if (start.getTime() <= now.getTime()) {
        continue;
      }

      // Tampoco se ofrece si se cruza con una cita existente.
      const taken = busy.some((item) => overlaps(start, end, item.start, item.end));
      if (taken) {
        continue;
      }

      slots.push(toTimeString(minute));
    }
  }

  // Dos franjas podrian solaparse: se quitan repetidos y se ordenan.
  return [...new Set(slots)].sort();
}

module.exports = {
  CLINIC_TIMEZONE,
  SLOT_MINUTES,
  DEFAULT_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  MAX_SCHEDULE_DAYS,
  parseDate,
  parseTime,
  toTimeString,
  atMinutes,
  combine,
  toDateString,
  toTimeOfDay,
  localWeekday,
  startOfDay,
  addDays,
  describeDateTime,
  overlaps,
  buildSlots,
};
