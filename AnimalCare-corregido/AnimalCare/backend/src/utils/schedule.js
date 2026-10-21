// Utilidades de fecha y hora para la agenda de citas.
//
// Decision del proyecto: todas las fechas y horas se manejan en UTC.
// La base de datos guarda DATETIME y el frontend envia y recibe siempre
// "AAAA-MM-DD" y "HH:MM". Al no mezclar husos horarios, la hora que elige
// el cliente es exactamente la que se guarda y la que ve el veterinario.

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

// Convierte "AAAA-MM-DD" en la medianoche UTC de ese dia.
// Devuelve null si el formato es incorrecto o el dia no existe
// (por ejemplo 2026-02-31, que JavaScript aceptaria corriendo el mes).
function parseDate(value) {
  const text = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (date.toISOString().slice(0, 10) !== text) {
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
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

// Une "AAAA-MM-DD" y "HH:MM" en un unico Date UTC.
function combine(dateText, timeText) {
  const date = parseDate(dateText);
  const minutes = parseTime(timeText);

  if (!date || minutes === null) {
    return null;
  }

  return new Date(date.getTime() + minutes * 60 * 1000);
}

// Devuelve la parte de fecha "AAAA-MM-DD" de un Date.
function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

// Devuelve la parte de hora "HH:MM" de un Date.
function toTimeOfDay(date) {
  return date.toISOString().slice(11, 16);
}

// Dos rangos de tiempo se cruzan si uno empieza antes de que el otro termine.
// Un rango que empieza justo cuando el otro acaba NO se considera choque.
function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

// Calcula los horarios libres de un veterinario para un dia concreto.
//
// availabilities: franjas semanales del veterinario ({ weekday, startTime, endTime })
// date:           Date UTC a medianoche del dia consultado
// durationMinutes: cuanto dura la cita que se quiere agendar
// busy:           citas ya agendadas ese dia ({ start: Date, end: Date })
// now:            momento actual, para descartar horarios que ya pasaron
//
// Devuelve un arreglo de horas "HH:MM" ordenadas.
function buildSlots({ availabilities, date, durationMinutes, busy = [], now = new Date() }) {
  const weekday = date.getUTCDay();
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
      const start = new Date(date.getTime() + minute * 60 * 1000);
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
  SLOT_MINUTES,
  DEFAULT_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  MAX_SCHEDULE_DAYS,
  parseDate,
  parseTime,
  toTimeString,
  combine,
  toDateString,
  toTimeOfDay,
  overlaps,
  buildSlots,
};
