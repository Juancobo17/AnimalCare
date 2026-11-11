import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import UrgenciaVeterinario from "./UrgenciaVeterinario";
import {
  urgenciasAbiertas,
  misUrgencias,
  aceptarUrgencia,
  completarUrgencia,
  liberarUrgencia,
} from "../services/emergency.service";
import { iniciarCita } from "../services/appointment.service";

vi.mock("../services/appointment.service", async (original) => ({ ...(await original()), iniciarCita: vi.fn() }));
vi.mock("../services/emergency.service", async (original) => ({
  ...(await original()),
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
      <Routes>
        <Route path="/" element={<UrgenciaVeterinario />} />
        <Route path="/pacientes/:id" element={<p>Pantalla de la historia clínica</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  urgenciasAbiertas.mockResolvedValue({ available: true, canAttend: true, requests: [] });
  misUrgencias.mockResolvedValue({ active: null, emergencies: [] });
  aceptarUrgencia.mockResolvedValue({ message: "Urgencia aceptada. Contacta al dueño." });
  completarUrgencia.mockResolvedValue({ message: "Urgencia marcada como atendida." });
  liberarUrgencia.mockResolvedValue({ message: "Urgencia liberada." });
  iniciarCita.mockResolvedValue({ message: "Atención iniciada." });
});

describe("UrgenciaVeterinario", () => {
  test("fuera de su horario no recibe urgencias y se le remite a Mi horario", async () => {
    urgenciasAbiertas.mockResolvedValue({ available: false, canAttend: true, requests: [] });
    pintar();
    expect(await screen.findByText(/Ahora no recibes urgencias/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mi horario" })).toHaveAttribute("href", "/mi-horario");
    expect(screen.queryByText(/Urgencias abiertas/)).not.toBeInTheDocument();
  });

  test("una cuenta sin aprobar no atiende urgencias", async () => {
    urgenciasAbiertas.mockResolvedValue({ available: false, canAttend: false, requests: [] });
    pintar();
    expect(await screen.findByText(/debe estar aprobada/)).toBeInTheDocument();
  });

  test("si aceptar choca con citas, pide confirmar y luego acepta pidiendo reagendar", async () => {
    urgenciasAbiertas.mockResolvedValue({ available: true, canAttend: true, requests: [ABIERTA] });
    const error = new Error("conflicto");
    error.response = {
      status: 409,
      data: {
        code: "APPOINTMENT_CONFLICT",
        message: "Tienes citas en ese horario.",
        conflicts: [{ id: 8, client: "Pedro Ruiz", scheduledAt: ahora(), durationMinutes: 30 }],
      },
    };
    aceptarUrgencia.mockRejectedValueOnce(error);
    pintar();

    await userEvent.click(await screen.findByRole("button", { name: "Aceptar" }));
    expect(await screen.findByText("Tienes citas en ese horario")).toBeInTheDocument();
    expect(screen.getByText(/Pedro Ruiz/)).toBeInTheDocument();
    expect(aceptarUrgencia).toHaveBeenLastCalledWith(3, false);

    await userEvent.click(screen.getByRole("button", { name: "Aceptar y pedir que reagenden" }));
    await waitFor(() => expect(aceptarUrgencia).toHaveBeenLastCalledWith(3, true));
  });

  test("dentro de su horario lista las urgencias abiertas y permite aceptarlas", async () => {
    urgenciasAbiertas.mockResolvedValue({ available: true, canAttend: true, requests: [ABIERTA] });
    pintar();

    expect(await screen.findByText("Urgencias abiertas (1)")).toBeInTheDocument();
    expect(screen.getByText(/Se tragó un hueso/)).toBeInTheDocument();
    expect(screen.getByText(/Calle 3 # 2-45/)).toBeInTheDocument();
    expect(screen.getByText(/Disponible: estás dentro de tu horario/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Aceptar" }));
    await waitFor(() => expect(aceptarUrgencia).toHaveBeenCalledWith(3, false));
  });

  test("con una urgencia en curso muestra el contacto, la historia y no deja aceptar otra", async () => {
    urgenciasAbiertas.mockResolvedValue({ available: true, canAttend: true, requests: [{ ...ABIERTA, id: 4 }] });
    misUrgencias.mockResolvedValue({
      active: {
        ...ABIERTA,
        id: 3,
        status: "ACCEPTED",
        acceptedAt: ahora(),
        expiresAt: null,
        appointment: { id: 20, status: "CONFIRMED" },
      },
      emergencies: [],
    });
    pintar();

    expect(await screen.findByText("Urgencia en curso")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "3001112233" })).toHaveAttribute("href", "tel:3001112233");
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Marcar como atendida" })).not.toBeInTheDocument();

    // Iniciar la atencion lleva a la historia clinica ligada a la cita de la urgencia.
    await userEvent.click(screen.getByRole("button", { name: "Iniciar atención" }));
    await waitFor(() => expect(iniciarCita).toHaveBeenCalledWith(20));
    expect(await screen.findByText("Pantalla de la historia clínica")).toBeInTheDocument();
  });

  test("con la atencion iniciada ofrece continuarla y ya no permite liberar la urgencia", async () => {
    misUrgencias.mockResolvedValue({
      active: {
        ...ABIERTA,
        status: "ACCEPTED",
        acceptedAt: ahora(),
        expiresAt: null,
        appointment: { id: 20, status: "IN_PROGRESS" },
      },
      emergencies: [],
    });
    pintar();

    expect(await screen.findByText("En atención")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continuar atención" })).toHaveAttribute("href", "/pacientes/5?cita=20");
    expect(screen.queryByRole("button", { name: "No puedo atenderla" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Iniciar atención" })).not.toBeInTheDocument();
  });

  test("una urgencia sin mascota no tiene historia: se termina directamente", async () => {
    misUrgencias.mockResolvedValue({
      active: { ...ABIERTA, pet: null, status: "ACCEPTED", acceptedAt: ahora(), expiresAt: null, appointment: { id: 20, status: "CONFIRMED" } },
      emergencies: [],
    });
    pintar();

    await userEvent.click(await screen.findByRole("button", { name: "Terminar atención" }));
    await waitFor(() => expect(completarUrgencia).toHaveBeenCalledWith(3));
  });

  test("liberar una urgencia pide confirmacion", async () => {
    misUrgencias.mockResolvedValue({
      active: {
        ...ABIERTA,
        status: "ACCEPTED",
        acceptedAt: ahora(),
        expiresAt: null,
        appointment: { id: 20, status: "CONFIRMED" },
      },
      emergencies: [],
    });
    pintar();

    await userEvent.click(await screen.findByRole("button", { name: "No puedo atenderla" }));
    expect(liberarUrgencia).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Sí, liberarla" }));
    await waitFor(() => expect(liberarUrgencia).toHaveBeenCalledWith(3));
  });
});
