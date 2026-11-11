// Pruebas unitarias de la zona horaria de la agenda (utils/schedule.js).
// No necesitan backend ni base de datos: `node --test tests/schedule.test.js`.
process.env.CLINIC_TIMEZONE = "America/Bogota";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

const s = require("../src/utils/schedule");

describe("zona horaria de la clinica", () => {
  test("una hora de pared de Bogota es un instante 5 horas despues en UTC", () => {
    assert.equal(s.combine("2026-11-16", "09:00").toISOString(), "2026-11-16T14:00:00.000Z");
    assert.equal(s.combine("2026-11-16", "23:30").toISOString(), "2026-11-17T04:30:00.000Z");
  });

  test("ida y vuelta: fecha, hora y dia de la semana se conservan", () => {
    const d = s.combine("2026-11-16", "09:00");
    assert.equal(s.toDateString(d), "2026-11-16");
    assert.equal(s.toTimeOfDay(d), "09:00");
    assert.equal(s.localWeekday(d), 1);
  });

  test("parseDate rechaza fechas inexistentes y formatos malos", () => {
    assert.equal(s.parseDate("2026-02-31"), null);
    assert.equal(s.parseDate("16/11/2026"), null);
    assert.equal(s.toDateString(s.parseDate("2026-02-28")), "2026-02-28");
  });

  test("'hoy' se calcula con la hora de Bogota, no con UTC", () => {
    // 22:00 del 11 de noviembre en Bogota = 03:00Z del 12.
    const noche = new Date("2026-11-12T03:00:00Z");
    assert.equal(s.toDateString(s.startOfDay(noche)), "2026-11-11");
    assert.equal(s.toDateString(s.addDays(s.startOfDay(noche), 1)), "2026-11-12");
  });

  test("a las 8:20 de la manana se ofrecen los turnos desde las 09:00", () => {
    const slots = s.buildSlots({
      availabilities: [{ weekday: 1, startTime: "09:00", endTime: "13:00" }],
      date: s.parseDate("2026-11-16"),
      durationMinutes: 30,
      now: new Date("2026-11-16T13:20:00Z"), // 08:20 Bogota
    });
    assert.deepEqual(slots.slice(0, 2), ["09:00", "09:30"]);
    assert.equal(slots.at(-1), "12:30");
  });

  test("a las 10:10 ya no se ofrecen los turnos de las 09:00 ni de las 10:00", () => {
    const slots = s.buildSlots({
      availabilities: [{ weekday: 1, startTime: "09:00", endTime: "13:00" }],
      date: s.parseDate("2026-11-16"),
      durationMinutes: 30,
      now: new Date("2026-11-16T15:10:00Z"), // 10:10 Bogota
    });
    assert.equal(slots[0], "10:30");
  });

  test("las citas ocupadas y los bloqueos se descuentan", () => {
    const dia = s.parseDate("2026-11-16");
    const slots = s.buildSlots({
      availabilities: [{ weekday: 1, startTime: "09:00", endTime: "11:00" }],
      date: dia,
      durationMinutes: 30,
      busy: [{ start: s.atMinutes(dia, 9 * 60), end: s.atMinutes(dia, 10 * 60) }],
      now: new Date("2026-11-16T00:00:00Z"),
    });
    assert.deepEqual(slots, ["10:00", "10:30"]);
  });

  test("describeDateTime usa la hora de la clinica", () => {
    assert.equal(s.describeDateTime(new Date("2026-11-16T14:00:00Z")), "lunes 16 de noviembre a las 09:00");
  });
});
