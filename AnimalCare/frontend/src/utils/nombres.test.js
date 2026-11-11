import { describe, expect, test } from "vitest";

import { inicialesDe, primerNombreDe, quitarTitulo } from "./nombres";

describe("nombres", () => {
  test("quita el titulo Dr. o Dra. al principio", () => {
    expect(quitarTitulo("Dra. Camila Rojas")).toBe("Camila Rojas");
    expect(quitarTitulo("Dr Andrés Rojas")).toBe("Andrés Rojas");
    expect(quitarTitulo("dra. laura")).toBe("laura");
  });

  test("no toca nombres sin titulo ni palabras que solo empiezan igual", () => {
    expect(quitarTitulo("Ana Gómez")).toBe("Ana Gómez");
    expect(quitarTitulo("Drake Smith")).toBe("Drake Smith");
  });

  test("si el nombre es solo el titulo, lo deja como esta", () => {
    expect(quitarTitulo("Dra.")).toBe("Dra.");
  });

  test("el primer nombre para saludar no es el titulo", () => {
    expect(primerNombreDe("Dra. Camila Rojas")).toBe("Camila");
    expect(primerNombreDe("Ana Gómez")).toBe("Ana");
    expect(primerNombreDe("  Luis  Torres ")).toBe("Luis");
    expect(primerNombreDe("")).toBe("");
    expect(primerNombreDe(undefined)).toBe("");
  });

  test("las iniciales salen del nombre y no del titulo", () => {
    expect(inicialesDe("Dra. Camila Rojas")).toBe("CR");
    expect(inicialesDe("Ana Gómez")).toBe("AG");
    expect(inicialesDe("Madonna")).toBe("M");
    expect(inicialesDe("Juan Carlos Pérez")).toBe("JC");
    expect(inicialesDe("")).toBe("");
  });
});
