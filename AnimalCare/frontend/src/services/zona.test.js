import { describe, expect, test } from "vitest";

import { instanteDe, fechaLocal, sumarDias } from "./zona";

describe("zona horaria de la clinica (America/Bogota)", () => {
  test("una hora de pared de Bogota es 5 horas despues en UTC", () => {
    expect(instanteDe("2026-11-16", "09:00").toISOString()).toBe("2026-11-16T14:00:00.000Z");
    expect(instanteDe("2026-11-16", "23:30").toISOString()).toBe("2026-11-17T04:30:00.000Z");
  });

  test("la fecha local de un instante se calcula en Bogota, no en UTC", () => {
    // 22:00 del 11 de noviembre en Bogota = 03:00Z del 12.
    expect(fechaLocal(new Date("2026-11-12T03:00:00Z"))).toBe("2026-11-11");
  });

  test("sumarDias respeta el cambio de mes y de año", () => {
    expect(sumarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
});
