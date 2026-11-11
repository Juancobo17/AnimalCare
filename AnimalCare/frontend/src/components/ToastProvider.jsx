// Avisos emergentes (toast): un mensaje corto que aparece en una esquina y se
// va solo. Reemplazan a los cuadros de exito que antes ocupaban lugar en la pagina.
//
// Uso directo:   const toast = useToast();  toast.mostrar("Cita agendada");
// Uso habitual:  <Alerta tipo="exito" mensajes={exito} />  ya lo muestra como toast.
//
// El proveedor vive por encima de las rutas: un aviso sigue visible aunque la
// pantalla cambie (por ejemplo, "Cita agendada" y luego se va a "Mis citas").
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import Icono from "./Icono";

// Cuanto dura un aviso en pantalla (se detiene mientras el cursor o el foco estan encima).
const DURACION_MS = 5000;
// Maximo de avisos a la vez: si llegan mas, se descartan los mas antiguos.
const MAXIMO = 4;

export const ContextoToast = createContext(null);

// Devuelve { mostrar(texto, tipo) } o null si no hay proveedor (por ejemplo, en pruebas aisladas).
export function useToast() {
  return useContext(ContextoToast);
}

let contador = 0;

function Toast({ toast, onCerrar }) {
  const [pausado, setPausado] = useState(false);

  // "version" cambia cuando el mismo mensaje se repite: reinicia el tiempo.
  useEffect(() => {
    if (pausado) return undefined;
    const temporizador = setTimeout(() => onCerrar(toast.id), DURACION_MS);
    return () => clearTimeout(temporizador);
  }, [pausado, toast.id, toast.version, onCerrar]);

  const esError = toast.tipo === "error";

  return (
    <div
      className={`toast ${esError ? "toast-error" : "toast-exito"}`}
      role={esError ? "alert" : undefined}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <span className="toast-icono" aria-hidden="true">
        <Icono nombre={esError ? "cerrar" : "check"} tamano={16} grosor={2.6} />
      </span>
      <p className="toast-texto">{toast.texto}</p>
      <button type="button" className="toast-cerrar" aria-label="Cerrar aviso" onClick={() => onCerrar(toast.id)}>
        <Icono nombre="cerrar" tamano={16} grosor={2.2} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const cerrar = useCallback((id) => {
    setToasts((actuales) => actuales.filter((t) => t.id !== id));
  }, []);

  const mostrar = useCallback((texto, tipo = "exito") => {
    if (!texto) return;
    setToasts((actuales) => {
      // Mismo mensaje ya visible: no se duplica, solo se reinicia su tiempo.
      const igual = actuales.find((t) => t.texto === texto && t.tipo === tipo);
      if (igual) {
        return actuales.map((t) => (t === igual ? { ...t, version: t.version + 1 } : t));
      }
      contador += 1;
      return [...actuales, { id: contador, texto, tipo, version: 0 }].slice(-MAXIMO);
    });
  }, []);

  const valor = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <ContextoToast.Provider value={valor}>
      {children}
      {/* Region "en vivo": los lectores de pantalla anuncian los avisos nuevos sin quitar el foco. */}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onCerrar={cerrar} />
        ))}
      </div>
    </ContextoToast.Provider>
  );
}
