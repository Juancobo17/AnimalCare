import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import UrgenciaVeterinario from "./UrgenciaVeterinario";
import {
  estadoDeTurno,
  ponerseDeTurno,
  urgenciasAbiertas,
  misUrgencias,
  aceptarUrgencia,
  completarUrgencia,
  liberarUrgencia,
} from "../services/emergency.service";

vi.mock("../services/emergency.service", async (original) => ({
  ...(await original()),
  estadoDeTurno: vi.fn(),
  ponerseDeTurno: vi.fn(),
  urgenciasAbiertas: vi.fn(),
  misUrgencias: vi.fn(),
  aceptarUrgencia: vi.fn(),
  completarUrgencia: vi.fn(),
  liberarUrgencia: vi.fn(),
}));

const ahora = () => new Date().toISOString();
const vencimiento = () => new Date(Date.now() + 20 * 60000).toISOString();

const ABIERTA = {
  id: 3,
  status: "OPEN",
  symptoms: "Se tragó un hueso",
  mode: "HOME",
  address: "Calle 3 # 2-45",
  phone: "3001112233",
  createdAt: ahora(),
  expiresAt: vencimiento(),
  client: { name: "Laura Gómez" },
  pet: { id: 5, name: "Michi", species: "Gato" },
};

function pintar() {
  return render(
    <MemoryRouter>
      <UrgenciaVeterinario />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  estadoDeTurno.mockResolvedValue({ active: false, until: null, hoursOptions: [4, 8, 12], canGoOnDuty: true });
  urgenciasAbiertas.mockResolvedValue({ onDuty: true, requests: [] });
  misUrgencias.mockResolvedValue({ active: null, emergencies: [] });
  ponerseDeTurno.mockResolvedValue({ message: "Estás de turno por 8 horas." });
  aceptarUrgencia.mockResolvedValue({ message: "Urgencia aceptada. Contacta al dueño." });
  completarUrgencia.mockResolvedValue({ message: "Urgencia marcada como atendida." });
  liberarUrgencia.mockResolvedValue({ message: "Urgencia liberada." });
});

describe("UrgenciaVeterinario", () => {
  test("fuera de turno ofrece 4, 8 y 12 horas y no muestra urgencias abiertas", async () => {
    pintar();
    expect(await screen.findByRole("button", { name: "De turno 8 horas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "De turno 4 horas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "De turno 12 horas" })).toBeInTheDocument();
    expect(screen.queryByText(/Urgencias abiertas/)).not.toBeInTheDocument();
    expect(urgenciasAbiertas).not.toHaveBeenCalled();
  });

  test("al elegir un turno lo activa", async () => {
    pintar();
    await userEvent.click(await screen.findByRole("button", { name: "De turno 8 horas" }));
    await waitFor(() => expect(ponerseDeTurno).toHaveBeenCalledWith(8));
    expect(await screen.findByText("Estás de turno por 8 horas.")).toBeInTheDocument();
  });

  test("una cuenta sin aprobar no puede ponerse de turno", async () => {
    estadoDeTurno.mockResolvedValue({ active: false, until: null, hoursOptions: [4, 8, 12], canGoOnDuty: false });
    pintar();
    expect(await screen.findByText(/debe estar aprobada/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /De turno/ })).not.toBeInTheDocument();
  });

  test("de turno lista las urgencias abiertas y permite aceptarlas", async () => {
    estadoDeTurno.mockResolvedValue({ active: true, until: new Date(Date.now() + 3600000).toISOString(), hoursOptions: [4, 8, 12], canGoOnDuty: true });
    urgenciasAbiertas.mockResolvedValue({ onDuty: true, requests: [ABIERTA] });
    pintar();

    expect(await screen.findByText("Urgencias abiertas (1)")).toBeInTheDocument();
    expect(screen.getByText(/Se tragó un hueso/)).toBeInTheDocument();
    expect(screen.getByText(/Calle 3 # 2-45/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salir de turno" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Aceptar" }));
    await waitFor(() => expect(aceptarUrgencia).toHaveBeenCalledWith(3));
  });

  test("con una urgencia en curso muestra el contacto, la historia y no deja aceptar otra", async () => {
    estadoDeTurno.mockResolvedValue({ active: true, until: new Date(Date.now() + 3600000).toISOString(), hoursOptions: [4, 8, 12], canGoOnDuty: true });
    urgenciasAbiertas.mockResolvedValue({ onDuty: true, requests: [{ ...ABIERTA, id: 4 }] });
    misUrgencias.mockResolvedValue({
      active: { ...ABIERTA, id: 3, status: "ACCEPTED", acceptedAt: ahora(), expiresAt: null },
      emergencies: [],
    });
    pintar();

    expect(await screen.findByText("Urgencia en curso")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "3001112233" })).toHaveAttribute("href", "tel:3001112233");
    expect(screen.getByRole("link", { name: "Ver historia clínica" })).toHaveAttribute("href", "/pacientes/5");
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Marcar como atendida" }));
    await waitFor(() => expect(completarUrgencia).toHaveBeenCalledWith(3));
  });

  test("liberar una urgencia pide confirmacion", async () => {
    estadoDeTurno.mockResolvedValue({ active: true, until: new Date(Date.now() + 3600000).toISOString(), hoursOptions: [4, 8, 12], canGoOnDuty: true });
    misUrgencias.mockResolvedValue({
      active: { ...ABIERTA, status: "ACCEPTED", acceptedAt: ahora(), expiresAt: null },
      emergencies: [],
    });
    pintar();

    await userEvent.click(await screen.findByRole("button", { name: "No puedo atenderla" }));
    expect(liberarUrgencia).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Sí, liberarla" }));
    await waitFor(() => expect(liberarUrgencia).toHaveBeenCalledWith(3));
  });
});
