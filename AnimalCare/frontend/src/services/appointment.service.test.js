import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { esCancelable, esCompletable, clientePuedeCancelar, inicioDeCita } from "./appointment.service";

// Reloj fijo: lunes 16 de noviembre de 2026, 10:00 en Bogota (15:00Z).
const AHORA = new Date("2026-11-16T15:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AHORA);
});
afterEach(() => vi.useRealTimers());

const cita = (time, status = "PENDING", date = "2026-11-16") => ({ date, time, status });

describe("reglas de las citas", () => {
  test("inicioDeCita interpreta la hora en la zona de la clinica", () => {
    expect(inicioDeCita(cita("10:00")).getTime()).toBe(AHORA.getTime());
  });

  test("una cita futura y activa se puede cancelar; una pasada o cancelada no", () => {
    expect(esCancelable(cita("13:00"))).toBe(true);
    expect(esCancelable(cita("09:00"))).toBe(false);
    expect(esCancelable(cita("13:00", "CANCELLED"))).toBe(false);
    expect(esCancelable(cita("13:00", "COMPLETED"))).toBe(false);
  });

  test("el cliente solo cancela con al menos 2 horas de anticipacion", () => {
    expect(clientePuedeCancelar(cita("12:00"))).toBe(true); // exactamente 2 h
    expect(clientePuedeCancelar(cita("11:30"))).toBe(false); // 1 h 30
    expect(clientePuedeCancelar(cita("09:00", "PENDING", "2026-11-17"))).toBe(true);
  });

  test("solo se marca como atendida una cita cuya hora ya llego", () => {
    expect(esCompletable(cita("09:30"))).toBe(true);
    expect(esCompletable(cita("10:00"))).toBe(true);
    expect(esCompletable(cita("10:30"))).toBe(false);
    expect(esCompletable(cita("09:30", "CANCELLED"))).toBe(false);
  });
});
