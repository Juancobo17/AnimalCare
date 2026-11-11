import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import Alerta from "./Alerta";
import { ToastProvider, useToast } from "./ToastProvider";

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

// Pagina de prueba: un boton que "guarda" y entrega un mensaje de exito, como las pantallas reales.
function Pagina({ fijo = false, tipo = "exito" }) {
  const [mensajes, setMensajes] = useState([]);
  return (
    <>
      <button type="button" onClick={() => setMensajes(["Perfil actualizado"])}>
        guardar
      </button>
      <Alerta tipo={tipo} fijo={fijo} mensajes={mensajes} />
    </>
  );
}

function conProveedor(ui) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("Toast", () => {
  test("un mensaje de exito aparece como toast y no como cuadro dentro de la pagina", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    conProveedor(<Pagina />);

    await usuario.click(screen.getByRole("button", { name: "guardar" }));

    expect(screen.getByText("Perfil actualizado")).toBeInTheDocument();
    // No hay cuadro role="alert" en la pagina: es un toast.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar aviso" })).toBeInTheDocument();
  });

  test("se va solo a los 5 segundos", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    conProveedor(<Pagina />);

    await usuario.click(screen.getByRole("button", { name: "guardar" }));
    expect(screen.getByText("Perfil actualizado")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4900));
    expect(screen.getByText("Perfil actualizado")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("Perfil actualizado")).not.toBeInTheDocument();
  });

  test("se puede cerrar con el boton", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    conProveedor(<Pagina />);

    await usuario.click(screen.getByRole("button", { name: "guardar" }));
    await usuario.click(screen.getByRole("button", { name: "Cerrar aviso" }));

    expect(screen.queryByText("Perfil actualizado")).not.toBeInTheDocument();
  });

  test("no se cierra mientras el cursor esta encima", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    conProveedor(<Pagina />);

    await usuario.click(screen.getByRole("button", { name: "guardar" }));
    await usuario.hover(screen.getByText("Perfil actualizado"));
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.getByText("Perfil actualizado")).toBeInTheDocument();

    await usuario.unhover(screen.getByText("Perfil actualizado"));
    act(() => vi.advanceTimersByTime(5100));
    expect(screen.queryByText("Perfil actualizado")).not.toBeInTheDocument();
  });

  test("el mismo mensaje repetido no se duplica: reinicia el tiempo", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    conProveedor(<Pagina />);

    await usuario.click(screen.getByRole("button", { name: "guardar" }));
    act(() => vi.advanceTimersByTime(3000));
    await usuario.click(screen.getByRole("button", { name: "guardar" }));

    expect(screen.getAllByText("Perfil actualizado")).toHaveLength(1);
    // 3s + 3s = 6s en total, pero el tiempo se reinicio al repetirse.
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText("Perfil actualizado")).toBeInTheDocument();
  });

  test("con 'fijo' el mensaje de exito se queda dentro de la pagina", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    conProveedor(<Pagina fijo />);

    await usuario.click(screen.getByRole("button", { name: "guardar" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Perfil actualizado");
    expect(screen.queryByRole("button", { name: "Cerrar aviso" })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(30000));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  test("los errores se quedan dentro de la pagina", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    conProveedor(<Pagina tipo="error" />);

    await usuario.click(screen.getByRole("button", { name: "guardar" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Perfil actualizado");
    expect(screen.queryByRole("button", { name: "Cerrar aviso" })).not.toBeInTheDocument();
  });

  test("el aviso sigue visible aunque la pagina que lo origino desaparezca", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    function App() {
      const [pantalla, setPantalla] = useState("a");
      return pantalla === "a" ? (
        <>
          <Alerta tipo="exito" mensajes={["Cita agendada"]} />
          <button type="button" onClick={() => setPantalla("b")}>
            ir
          </button>
        </>
      ) : (
        <p>otra pantalla</p>
      );
    }
    conProveedor(<App />);

    await usuario.click(screen.getByRole("button", { name: "ir" }));

    expect(screen.getByText("otra pantalla")).toBeInTheDocument();
    expect(screen.getByText("Cita agendada")).toBeInTheDocument();
  });

  test("useToast permite mostrar un aviso directamente", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    function Boton() {
      const toast = useToast();
      return (
        <button type="button" onClick={() => toast.mostrar("Copiado")}>
          copiar
        </button>
      );
    }
    conProveedor(<Boton />);

    await usuario.click(screen.getByRole("button", { name: "copiar" }));
    expect(screen.getByText("Copiado")).toBeInTheDocument();
  });
});
