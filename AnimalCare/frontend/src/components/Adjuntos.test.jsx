import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import Adjuntos from "./Adjuntos";
import { abrirAdjunto, quitarAdjunto } from "../services/medicalRecord.service";

// Solo se simulan las llamadas a la red; el resto del servicio es real.
vi.mock("../services/medicalRecord.service", async (original) => ({
  ...(await original()),
  abrirAdjunto: vi.fn(() => Promise.resolve()),
  quitarAdjunto: vi.fn(() => Promise.resolve({})),
  adjuntarArchivo: vi.fn(() => Promise.resolve({})),
}));

const adjuntos = [
  { id: 1, name: "Hemograma.pdf", type: "application/pdf", size: 120_000 },
  { id: 2, name: "Torax.png", type: "image/png", size: 2_500_000 },
];

const entrada = (extra = {}) => ({ id: 10, attachments: adjuntos, canEdit: true, ...extra });

beforeEach(() => vi.clearAllMocks());

describe("Adjuntos", () => {
  test("el dueño ve los archivos con su tipo y tamaño, pero no puede agregar ni quitar", () => {
    render(<Adjuntos entrada={entrada()} esVeterinario={false} />);
    expect(screen.getByText("Hemograma.pdf")).toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("2.4 MB")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adjuntar archivo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
  });

  test("sin archivos y sin permiso de edicion no muestra nada", () => {
    const { container } = render(<Adjuntos entrada={entrada({ attachments: [] })} esVeterinario={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("al pulsar el nombre se abre el archivo protegido", async () => {
    render(<Adjuntos entrada={entrada()} esVeterinario={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Hemograma.pdf" }));
    expect(abrirAdjunto).toHaveBeenCalledWith(1);
  });

  test("el veterinario autor puede adjuntar y quitar con confirmacion", async () => {
    const onCambio = vi.fn();
    render(<Adjuntos entrada={entrada()} esVeterinario onCambio={onCambio} />);
    expect(screen.getByRole("button", { name: "Adjuntar archivo" })).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Quitar" })[0]);
    expect(quitarAdjunto).not.toHaveBeenCalled(); // pide confirmacion primero
    await userEvent.click(screen.getByRole("button", { name: "Sí, quitar" }));
    expect(quitarAdjunto).toHaveBeenCalledWith(1);
    expect(onCambio).toHaveBeenCalled();
  });

  test("un veterinario que no es el autor ve los archivos sin controles de edicion", () => {
    render(<Adjuntos entrada={entrada({ canEdit: false })} esVeterinario />);
    expect(screen.getByText("Torax.png")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adjuntar archivo" })).not.toBeInTheDocument();
  });

  test("con 10 archivos ya no ofrece adjuntar mas", () => {
    const diez = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `a${i}.pdf`, type: "application/pdf", size: 1000 }));
    render(<Adjuntos entrada={entrada({ attachments: diez })} esVeterinario />);
    expect(screen.queryByRole("button", { name: "Adjuntar archivo" })).not.toBeInTheDocument();
    expect(screen.getByText(/máximo de 10 archivos/)).toBeInTheDocument();
  });
});
