// Archivos adjuntos de una entrada de historia clinica (examenes, radiografias).
//
// Dueño: ve la lista y abre los archivos. Veterinario autor de una entrada
// vigente: ademas adjunta (PDF, JPG o PNG, hasta 5 MB y 10 por entrada) y quita.
import { useRef, useState } from "react";

import {
  adjuntarArchivo,
  quitarAdjunto,
  abrirAdjunto,
  formatearTamano,
  TIPOS_ADJUNTO,
  MAX_ADJUNTO_MB,
  MAX_ADJUNTOS,
} from "../services/medicalRecord.service";
import { obtenerMensajesDeError } from "../services/api";

function etiquetaTipo(tipo) {
  if (tipo === "application/pdf") return "PDF";
  return tipo === "image/png" ? "PNG" : "JPG";
}

function Adjuntos({ entrada, esVeterinario, onCambio }) {
  const lista = entrada.attachments || [];
  const puedeEditar = esVeterinario && entrada.canEdit;
  const entradaArchivo = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [quitando, setQuitando] = useState(null);
  const [error, setError] = useState("");

  if (lista.length === 0 && !puedeEditar) {
    return null;
  }

  async function elegir(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    setError("");
    if (!TIPOS_ADJUNTO.includes(archivo.type)) {
      setError("Formato no permitido. Usa PDF, JPG o PNG.");
      return;
    }
    if (archivo.size > MAX_ADJUNTO_MB * 1024 * 1024) {
      setError(`El archivo no puede pesar más de ${MAX_ADJUNTO_MB} MB.`);
      return;
    }
    setSubiendo(true);
    try {
      await adjuntarArchivo(entrada.id, archivo);
      await onCambio?.();
    } catch (e) {
      setError(obtenerMensajesDeError(e).join(" "));
    } finally {
      setSubiendo(false);
    }
  }

  function abrir(id) {
    setError("");
    abrirAdjunto(id).catch(() => setError("No se pudo abrir el archivo."));
  }

  async function confirmarQuitar(id) {
    setError("");
    try {
      await quitarAdjunto(id);
      setQuitando(null);
      await onCambio?.();
    } catch (e) {
      setError(obtenerMensajesDeError(e).join(" "));
    }
  }

  return (
    <div className="adjuntos">
      {lista.length > 0 && <h5>Archivos adjuntos ({lista.length})</h5>}

      {lista.length > 0 && (
        <ul className="adjuntos-lista">
          {lista.map((a) => (
            <li key={a.id}>
              <span className="adjunto-tipo">{etiquetaTipo(a.type)}</span>
              <button type="button" className="enlace-accion adjunto-nombre" onClick={() => abrir(a.id)}>
                {a.name}
              </button>
              <span className="texto-suave">{formatearTamano(a.size)}</span>
              {puedeEditar &&
                (quitando === a.id ? (
                  <span className="acciones-linea" role="alertdialog" aria-label={`Quitar ${a.name}`}>
                    <button type="button" className="boton boton-peligro boton-auto" onClick={() => confirmarQuitar(a.id)}>
                      Sí, quitar
                    </button>
                    <button type="button" className="boton boton-secundario boton-auto" onClick={() => setQuitando(null)}>
                      No
                    </button>
                  </span>
                ) : (
                  <button type="button" className="enlace-accion adjunto-quitar" onClick={() => setQuitando(a.id)}>
                    Quitar
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}

      {puedeEditar && lista.length < MAX_ADJUNTOS && (
        <div className="no-imprimir">
          <input
            ref={entradaArchivo}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            hidden
            onChange={elegir}
          />
          <button
            type="button"
            className="boton boton-secundario boton-auto"
            disabled={subiendo}
            onClick={() => entradaArchivo.current?.click()}
          >
            {subiendo ? "Subiendo..." : "Adjuntar archivo"}
          </button>
          <span className="ayuda">
            PDF, JPG o PNG, hasta {MAX_ADJUNTO_MB} MB. Solo lo ven el dueño y los veterinarios que atienden a la mascota.
          </span>
        </div>
      )}
      {puedeEditar && lista.length >= MAX_ADJUNTOS && (
        <p className="ayuda">Llegaste al máximo de {MAX_ADJUNTOS} archivos por entrada.</p>
      )}

      {error && <p className="error-campo">{error}</p>}
    </div>
  );
}

export default Adjuntos;
