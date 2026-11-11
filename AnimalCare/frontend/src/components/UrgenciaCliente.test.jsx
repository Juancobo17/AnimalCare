import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import UrgenciaCliente from "./UrgenciaCliente";
import { pedirUrgencia, cancelarUrgencia, misUrgencias, disponibilidadUrgencias } from "../services/emergency.service";
import { listarMascotas } from "../services/pet.service";

// Solo se simula la red; las reglas de validacion y los textos son los reales.
vi.mock("../services/emergency.service", async (original) => ({
  ...(await original()),
  misUrgencias: vi.fn(),
  disponibilidadUrgencias: vi.fn(),
  pedirUrgencia: vi.fn(),
  cancelarUrgencia: vi.fn(),
}));
vi.mock("../services/pet.service", async (original) => ({ ...(await original()), listarMascotas: vi.fn() }));

const DISPONIBLE = { available: 2, home: 1, clinic: 2, ttlMinutes: 30 };
const ahora = () => new Date().toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  disponibilidadUrgencias.mockResolvedValue(DISPONIBLE);
  misUrgencias.mockResolvedValue({ active: null, emergencies: [] });
  listarMascotas.mockResolvedValue({ pets: [{ id: 5, name: "Michi", species: "Gato" }] });
  pedirUrgencia.mockResolvedValue({ message: "Avisamos a 2 veterinario(s) disponibles." });
  cancelarUrgencia.mockResolvedValue({ message: "Urgencia cancelada." });
});

describe("UrgenciaCliente", () => {
  test("muestra el aviso de emergencia vital, los veterinarios disponibles y el formulario", async () => {
    render(<UrgenciaCliente />);
    expect(await screen.findByText(/Hay 2 veterinario\(s\) atendiendo ahora/)).toBeInTheDocument();
    expect(screen.getByText(/clínica veterinaria más cercana/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pedir atención urgente" })).toBeEnabled();
  });

  test("sin veterinarios atendiendo avisa y no deja enviar", async () => {
    disponibilidadUrgencias.mockResolvedValue({ available: 0, home: 0, clinic: 0, ttlMinutes: 30 });
    render(<UrgenciaCliente />);
    expect(await screen.findByText(/no hay veterinarios atendiendo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pedir atención urgente" })).toBeDisabled();
  });

  test("valida descripcion, direccion a domicilio y telefono antes de enviar", async () => {
    render(<UrgenciaCliente />);
    await screen.findByText(/Hay 2 veterinario/);

    await userEvent.click(screen.getByRole("button", { name: "Pedir atención urgente" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Describe qué le pasa a tu mascota");
    expect(screen.getByRole("alert")).toHaveTextContent("teléfono de contacto válido");
    expect(pedirUrgencia).not.toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText(/A domicilio/));
    await userEvent.click(screen.getByRole("button", { name: "Pedir atención urgente" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Indica la dirección");
  });

  test("envia la urgencia con los datos del formulario", async () => {
    render(<UrgenciaCliente />);
    await screen.findByText(/Hay 2 veterinario/);

    await userEvent.selectOptions(screen.getByLabelText("Mascota"), "5");
    await userEvent.type(screen.getByLabelText(/¿Qué le pasa\?/), "Vomita sin parar desde hace horas");
    await userEvent.type(screen.getByLabelText(/Teléfono de contacto/), "3001234567");
    await userEvent.click(screen.getByRole("button", { name: "Pedir atención urgente" }));

    await waitFor(() => expect(pedirUrgencia).toHaveBeenCalledTimes(1));
    expect(pedirUrgencia).toHaveBeenCalledWith({
      petId: 5,
      symptoms: "Vomita sin parar desde hace horas",
      mode: "CLINIC",
      address: null,
      phone: "3001234567",
    });
    expect(await screen.findByText("Avisamos a 2 veterinario(s) disponibles.")).toBeInTheDocument();
  });

  test("mientras nadie acepta muestra la busqueda y deja cancelar con confirmacion", async () => {
    misUrgencias.mockResolvedValue({
      active: {
        id: 9,
        status: "OPEN",
        symptoms: "No respira bien",
        mode: "CLINIC",
        phone: "3001234567",
        createdAt: ahora(),
        expiresAt: new Date(Date.now() + 25 * 60000).toISOString(),
        pet: { id: 5, name: "Michi", species: "Gato" },
        vet: null,
      },
      emergencies: [],
    });
    render(<UrgenciaCliente />);

    expect(await screen.findByText(/Buscando un veterinario disponible/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pedir atención urgente" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar la solicitud" }));
    expect(cancelarUrgencia).not.toHaveBeenCalled(); // pide confirmacion
    await userEvent.click(screen.getByRole("button", { name: "Sí, cancelar" }));
    expect(cancelarUrgencia).toHaveBeenCalledWith(9);
  });

  test("cuando un veterinario acepta muestra quien es y su telefono", async () => {
    misUrgencias.mockResolvedValue({
      active: {
        id: 9,
        status: "ACCEPTED",
        symptoms: "No respira bien",
        mode: "CLINIC",
        phone: "3001234567",
        createdAt: ahora(),
        acceptedAt: ahora(),
        expiresAt: null,
        pet: null,
        vet: { name: "Dra. Camila Rojas", specialty: "Medicina felina", phone: "3105551234", address: "Carrera 9 # 4-12" },
      },
      emergencies: [],
    });
    render(<UrgenciaCliente />);

    expect(await screen.findByText("Dra. Camila Rojas atenderá tu urgencia")).toBeInTheDocument();
    expect(screen.getByText(/Carrera 9 # 4-12/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "3105551234" })).toHaveAttribute("href", "tel:3105551234");
    expect(screen.getByRole("button", { name: "Ya no la necesito" })).toBeInTheDocument();
  });
});
