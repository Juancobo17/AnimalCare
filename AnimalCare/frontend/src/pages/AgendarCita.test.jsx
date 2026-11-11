// Pruebas del agendamiento por pasos.
// Los servicios de red se simulan: aqui solo se comprueba el comportamiento de la pantalla.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import AgendarCita from "./AgendarCita";

// La cabecera pide notificaciones a la API: no interesa en estas pruebas.
vi.mock("../components/Cabecera", () => ({ default: () => <header>cabecera</header> }));

vi.mock("../services/vet.service", async (importOriginal) => ({
  ...(await importOriginal()),
  obtenerVeterinario: vi.fn(),
  obtenerDiasDisponibles: vi.fn(),
  obtenerHorarios: vi.fn(),
}));

vi.mock("../services/appointment.service", async (importOriginal) => ({
  ...(await importOriginal()),
  agendarCita: vi.fn(),
}));

vi.mock("../services/pet.service", async (importOriginal) => ({
  ...(await importOriginal()),
  listarMascotas: vi.fn(),
}));

import { obtenerVeterinario, obtenerDiasDisponibles, obtenerHorarios } from "../services/vet.service";
import { agendarCita } from "../services/appointment.service";
import { listarMascotas } from "../services/pet.service";

const VETERINARIO = {
  id: 7,
  name: "Dra. Camila Rojas",
  specialty: "Medicina felina",
  address: "Carrera 9 # 4-12",
  photoUrl: null,
  clinicService: true,
  homeService: true,
  services: [{ id: 3, name: "Vacunación", durationMinutes: 30, price: 60000 }],
};

const MASCOTAS = [
  { id: 1, name: "Luna", species: "Gato", sex: "Hembra", birthDate: "2023-01-10", weight: 4 },
  { id: 2, name: "Max", species: "Perro", sex: "Macho", birthDate: "2020-05-02", weight: 20 },
];

function pintar() {
  return render(
    <MemoryRouter initialEntries={["/veterinarios/7/agendar"]}>
      <Routes>
        <Route path="/veterinarios/:id/agendar" element={<AgendarCita />} />
        <Route path="/citas" element={<p>pantalla de citas</p>} />
      </Routes>
    </MemoryRouter>
  );
}

// Elige una opcion de una lista desplegable propia: se abre y se pulsa la opcion.
async function elegirOpcion(usuario, etiqueta, opcion) {
  await usuario.click(await screen.findByLabelText(etiqueta));
  await usuario.click(await screen.findByRole("option", { name: opcion }));
}

// Lleva el formulario hasta el paso 3 (fecha y hora) con datos validos.
async function hastaElPaso3(usuario) {
  await screen.findByText("Agendar cita");
  await elegirOpcion(usuario, /Mascota/, /Luna/);
  await usuario.click(screen.getByRole("button", { name: "Continuar" }));
  await usuario.click(await screen.findByLabelText(/En la veterinaria/));
  await usuario.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByText(/Elige un turno libre/);
}

async function elegirDiaYHora(usuario) {
  await usuario.click(await screen.findByRole("button", { name: /turnos libres/ }));
  await usuario.click(await screen.findByRole("button", { name: "10:00" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  obtenerVeterinario.mockResolvedValue(VETERINARIO);
  obtenerDiasDisponibles.mockResolvedValue([{ date: "2026-11-20", available: 5 }]);
  obtenerHorarios.mockResolvedValue({ slots: ["09:00", "10:00", "11:00"] });
  listarMascotas.mockResolvedValue({ pets: MASCOTAS });
  agendarCita.mockResolvedValue({});
});

describe("AgendarCita por pasos", () => {
  test("empieza en el paso 1 y no avanza sin elegir mascota", async () => {
    const usuario = userEvent.setup();
    pintar();

    await screen.findByText(/Paso 1 de 4/);
    await usuario.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Elige la mascota que vas a llevar.")).toBeInTheDocument();
    expect(screen.getByText(/Paso 1 de 4/)).toBeInTheDocument();
  });

  test("en el paso de lugar pide la direccion si la atencion es a domicilio", async () => {
    const usuario = userEvent.setup();
    pintar();

    await elegirOpcion(usuario, /Mascota/, /Luna/);
    await usuario.click(screen.getByRole("button", { name: "Continuar" }));
    await usuario.click(await screen.findByLabelText(/A domicilio/));
    await usuario.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText(/Indica la dirección/)).toBeInTheDocument();
    expect(screen.getByText(/Paso 2 de 4/)).toBeInTheDocument();
  });

  test("llegar al ultimo paso NO confirma la cita por si solo", async () => {
    const usuario = userEvent.setup();
    pintar();

    await hastaElPaso3(usuario);
    await elegirDiaYHora(usuario);
    await usuario.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText(/Revisa y confirma tu cita/)).toBeInTheDocument();
    expect(agendarCita).not.toHaveBeenCalled();
  });

  test("'Confirmar cita' no es un boton de envio (evita que se confirme sola al llegar al paso 4)", async () => {
    // El error real: el boton "Continuar" del paso 3 y "Confirmar cita" del paso 4 ocupan el
    // mismo lugar. Si Confirmar fuera type="submit", el clic en Continuar enviaba el formulario
    // en los navegadores. El simulador de pruebas no reproduce ese choque, por eso se revisa el tipo.
    const usuario = userEvent.setup();
    pintar();

    await hastaElPaso3(usuario);
    await elegirDiaYHora(usuario);
    await usuario.click(screen.getByRole("button", { name: "Continuar" }));

    const confirmar = await screen.findByRole("button", { name: "Confirmar cita" });
    expect(confirmar).toHaveAttribute("type", "button");
    expect(agendarCita).not.toHaveBeenCalled();
  });

  test("escribir el motivo con Enter no envia el formulario", async () => {
    const usuario = userEvent.setup();
    pintar();

    await hastaElPaso3(usuario);
    await elegirDiaYHora(usuario);
    await usuario.click(screen.getByRole("button", { name: "Continuar" }));

    const motivo = await screen.findByLabelText(/Motivo de la consulta/);
    await usuario.type(motivo, "Tos{Enter}desde ayer{Enter}");

    expect(motivo).toHaveValue("Tos\ndesde ayer\n");
    expect(agendarCita).not.toHaveBeenCalled();
  });

  test("al confirmar envia los datos elegidos", async () => {
    const usuario = userEvent.setup();
    pintar();

    await hastaElPaso3(usuario);
    await elegirDiaYHora(usuario);
    await usuario.click(screen.getByRole("button", { name: "Continuar" }));
    await usuario.type(await screen.findByLabelText(/Motivo de la consulta/), "Control");
    await usuario.click(screen.getByRole("button", { name: "Confirmar cita" }));

    await waitFor(() => expect(agendarCita).toHaveBeenCalledTimes(1));
    expect(agendarCita).toHaveBeenCalledWith({
      vetProfileId: 7,
      serviceId: null,
      petId: 1,
      mode: "CLINIC",
      date: "2026-11-20",
      time: "10:00",
      address: null,
      notes: "Control",
    });
  });

  test("si el horario se ocupo vuelve al paso de fecha y hora", async () => {
    agendarCita.mockRejectedValue({
      response: { data: { errors: ["Ese horario ya no está disponible."] } },
    });
    const usuario = userEvent.setup();
    pintar();

    await hastaElPaso3(usuario);
    await elegirDiaYHora(usuario);
    await usuario.click(screen.getByRole("button", { name: "Continuar" }));
    await usuario.click(await screen.findByRole("button", { name: "Confirmar cita" }));

    expect(await screen.findByText(/Paso 3 de 4/)).toBeInTheDocument();
  });

  test("Atras conserva lo que se habia elegido", async () => {
    const usuario = userEvent.setup();
    pintar();

    await hastaElPaso3(usuario);
    await usuario.click(screen.getByRole("button", { name: "Atrás" }));

    expect(await screen.findByLabelText(/En la veterinaria/)).toBeChecked();
  });
});
