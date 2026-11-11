import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import Alerta from "./Alerta";

describe("Alerta", () => {
  test("sin mensajes no muestra nada", () => {
    const { container } = render(<Alerta tipo="error" mensajes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("con un mensaje lo muestra sin encabezado", () => {
    render(<Alerta tipo="exito" mensajes={["Cita agendada"]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Cita agendada");
    expect(screen.queryByText("Revisa los siguientes datos:")).not.toBeInTheDocument();
  });

  test("con varios mensajes los lista con el encabezado (AN-6 escenario 3)", () => {
    render(<Alerta tipo="error" mensajes={["El correo no tiene un formato válido", "La contraseña es corta"]} />);
    expect(screen.getByText("Revisa los siguientes datos:")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  test("muestra Reintentar solo cuando se pasa onReintentar", async () => {
    const onReintentar = vi.fn();
    render(<Alerta tipo="error" mensajes={["Sin conexión"]} onReintentar={onReintentar} />);
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });
});
