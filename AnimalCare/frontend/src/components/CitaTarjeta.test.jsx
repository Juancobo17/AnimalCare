import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import CitaTarjeta from "./CitaTarjeta";

// Lunes 16 de noviembre de 2026, 10:00 en Bogota.
const AHORA = new Date("2026-11-16T15:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(AHORA);
});
afterEach(() => vi.useRealTimers());

const base = {
  id: 1,
  date: "2026-11-16",
  time: "15:00",
  status: "PENDING",
  mode: "CLINIC",
  durationMinutes: 30,
  address: null,
  notes: null,
  client: { name: "Laura Gómez", email: "laura@test.com" },
  vet: { id: 7, name: "Dra. Camila Rojas", specialty: "Medicina felina", address: "Carrera 9 # 4-12", phone: "3105551234" },
  service: null,
  pet: null,
  review: null,
  medicalRecordId: null,
};

function pintar(cita, props = {}) {
  return render(
    <MemoryRouter>
      <CitaTarjeta cita={cita} onActualizada={() => {}} {...props} />
    </MemoryRouter>
  );
}

describe("CitaTarjeta", () => {
  test("el cliente ve al veterinario, la direccion del consultorio y puede cancelar", () => {
    pintar(base);
    expect(screen.getByText(/Dra. Camila Rojas/)).toBeInTheDocument();
    expect(screen.getByText(/Carrera 9 # 4-12/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar cita" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
  });

  test("a menos de 2 horas el cliente no ve el boton y se le indica llamar al veterinario", () => {
    pintar({ ...base, time: "11:00" });
    expect(screen.queryByRole("button", { name: "Cancelar cita" })).not.toBeInTheDocument();
    expect(screen.getByText(/comunícate con el veterinario al 3105551234/)).toBeInTheDocument();
  });

  test("el veterinario ve al cliente y las acciones de su agenda", () => {
    pintar(base, { perspectiva: "veterinario" });
    expect(screen.getByText("Laura Gómez")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reprogramar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar cita" })).toBeInTheDocument();
    // Su propia direccion no se repite en cada cita.
    expect(screen.queryByText(/Carrera 9 # 4-12/)).not.toBeInTheDocument();
  });

  test("una cita atendida sin reseña ofrece calificar; con reseña la muestra", () => {
    pintar({ ...base, time: "09:00", status: "COMPLETED" });
    expect(screen.getByRole("button", { name: /Calificar atención/ })).toBeInTheDocument();

    pintar({ ...base, id: 2, time: "09:00", status: "COMPLETED", review: { rating: 4, comment: "Muy amable" } });
    expect(screen.getByText(/Muy amable/)).toBeInTheDocument();
  });

  test("sin onActualizada no se muestran acciones (panel de solo lectura)", () => {
    render(
      <MemoryRouter>
        <CitaTarjeta cita={base} />
      </MemoryRouter>
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
