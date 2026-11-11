import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";

import Selector from "./Selector";

// Selector dentro de un formulario con su etiqueta, igual que se usa en la app.
function Formulario({ inicial = "", alCambiar = () => {} }) {
  const [valor, setValor] = useState(inicial);
  return (
    <form>
      <label htmlFor="modalidad">Modalidad</label>
      <Selector
        id="modalidad"
        name="mode"
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
          alCambiar(e);
        }}
      >
        <option value="">Todas</option>
        <option value="CLINIC">En la veterinaria</option>
        <option value="HOME">A domicilio</option>
        <option value="X" disabled>
          No disponible
        </option>
      </Selector>
    </form>
  );
}

describe("Selector", () => {
  test("muestra la opcion elegida y la etiqueta lo nombra como un campo", () => {
    render(<Formulario inicial="HOME" />);
    const campo = screen.getByRole("combobox", { name: "Modalidad" });
    expect(campo).toHaveTextContent("A domicilio");
    expect(campo).toHaveAttribute("aria-expanded", "false");
  });

  test("se abre al pulsarlo y elige con el raton, avisando con name y value", async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(<Formulario alCambiar={alCambiar} />);

    await usuario.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await usuario.click(screen.getByRole("option", { name: "En la veterinaria" }));

    expect(alCambiar).toHaveBeenCalledWith({ target: { name: "mode", value: "CLINIC" } });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("En la veterinaria");
  });

  test("se maneja solo con el teclado: flechas, Enter y Escape", async () => {
    const usuario = userEvent.setup();
    render(<Formulario />);

    screen.getByRole("combobox").focus();
    await usuario.keyboard("{ArrowDown}"); // abre
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await usuario.keyboard("{ArrowDown}{ArrowDown}{Enter}"); // Todas -> En la veterinaria -> A domicilio
    expect(screen.getByRole("combobox")).toHaveTextContent("A domicilio");

    await usuario.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("A domicilio");
  });

  test("una opcion deshabilitada no se puede elegir", async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(<Formulario alCambiar={alCambiar} />);

    await usuario.click(screen.getByRole("combobox"));
    await usuario.click(screen.getByRole("option", { name: "No disponible" }));

    expect(alCambiar).not.toHaveBeenCalled();
  });

  test("se cierra al hacer clic fuera", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <Formulario />
        <button type="button">fuera</button>
      </>
    );

    await usuario.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "fuera" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("al escribir una letra salta a la opcion que empieza con ella", async () => {
    const usuario = userEvent.setup();
    render(<Formulario />);

    screen.getByRole("combobox").focus();
    await usuario.keyboard("a{Enter}"); // "A domicilio"
    expect(screen.getByRole("combobox")).toHaveTextContent("A domicilio");
  });
});
