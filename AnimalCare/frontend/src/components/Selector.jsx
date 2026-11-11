// Lista desplegable propia (reemplaza al <select> nativo, cuya lista abierta
// la dibuja el navegador y no se puede estilizar).
//
// Se usa igual que un <select>: recibe <option> como hijos y su onChange recibe
// un objeto con target.name y target.value, asi los formularios existentes no cambian.
//
// Accesibilidad (patron "select-only combobox" de WAI-ARIA):
//   - El boton es role="combobox" y la lista role="listbox".
//   - Teclado: flechas, Inicio/Fin, Enter o Espacio para elegir, Escape para cerrar
//     y una letra para saltar a la opcion que empieza con ella.
//   - Un <label htmlFor={id}> funciona igual que con un <select>.
import { Children, useEffect, useId, useRef, useState } from "react";

import Icono from "./Icono";

// Convierte los <option> hijos en una lista de { valor, texto, deshabilitada }.
function leerOpciones(hijos) {
  return Children.toArray(hijos)
    .filter((hijo) => hijo && hijo.type === "option")
    .map((hijo) => ({
      valor: String(hijo.props.value ?? ""),
      texto: Children.toArray(hijo.props.children).join(""),
      deshabilitada: Boolean(hijo.props.disabled),
    }));
}

function Selector({ id, name, value, onChange, children, disabled = false, className = "", ...resto }) {
  const idLista = useId();
  const opciones = leerOpciones(children);

  const indiceElegido = Math.max(
    0,
    opciones.findIndex((o) => o.valor === String(value ?? ""))
  );
  const elegida = opciones[indiceElegido];

  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(indiceElegido);
  const [haciaArriba, setHaciaArriba] = useState(false);
  const contenedorRef = useRef(null);
  const listaRef = useRef(null);
  const escrito = useRef({ texto: "", momento: 0 });

  // Se cierra al hacer clic fuera del selector.
  useEffect(() => {
    if (!abierto) return undefined;
    function alClicFuera(evento) {
      if (contenedorRef.current && !contenedorRef.current.contains(evento.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClicFuera);
    return () => document.removeEventListener("mousedown", alClicFuera);
  }, [abierto]);

  // La opcion activa siempre queda a la vista dentro de la lista.
  useEffect(() => {
    if (!abierto) return;
    listaRef.current?.children[activo]?.scrollIntoView?.({ block: "nearest" });
  }, [abierto, activo]);

  function abrir() {
    if (disabled) return;
    // Si no hay espacio debajo, la lista se abre hacia arriba.
    const caja = contenedorRef.current?.getBoundingClientRect();
    setHaciaArriba(Boolean(caja) && window.innerHeight - caja.bottom < 280 && caja.top > 280);
    setActivo(indiceElegido);
    setAbierto(true);
  }

  function elegir(indice) {
    const opcion = opciones[indice];
    if (!opcion || opcion.deshabilitada) return;
    setAbierto(false);
    if (opcion.valor !== String(value ?? "")) {
      onChange?.({ target: { name, value: opcion.valor } });
    }
  }

  // Mueve la opcion activa saltando las deshabilitadas.
  function mover(paso, desde = activo) {
    let siguiente = desde;
    for (let i = 0; i < opciones.length; i += 1) {
      siguiente = Math.min(Math.max(siguiente + paso, 0), opciones.length - 1);
      if (!opciones[siguiente].deshabilitada) return setActivo(siguiente);
      if (siguiente === 0 || siguiente === opciones.length - 1) break;
    }
    return undefined;
  }

  function alPulsarTecla(evento) {
    switch (evento.key) {
      case "ArrowDown":
        evento.preventDefault();
        if (!abierto) abrir();
        else mover(1);
        break;
      case "ArrowUp":
        evento.preventDefault();
        if (!abierto) abrir();
        else mover(-1);
        break;
      case "Home":
        if (abierto) {
          evento.preventDefault();
          mover(1, -1);
        }
        break;
      case "End":
        if (abierto) {
          evento.preventDefault();
          mover(-1, opciones.length);
        }
        break;
      case "Enter":
      case " ":
        evento.preventDefault();
        if (abierto) elegir(activo);
        else abrir();
        break;
      case "Escape":
        if (abierto) {
          evento.preventDefault();
          setAbierto(false);
        }
        break;
      case "Tab":
        setAbierto(false);
        break;
      default:
        // Escribir una letra salta a la primera opcion que empieza con ella.
        if (evento.key.length === 1 && !evento.ctrlKey && !evento.metaKey && !evento.altKey) {
          const ahora = Date.now();
          const previo = ahora - escrito.current.momento < 700 ? escrito.current.texto : "";
          escrito.current = { texto: previo + evento.key.toLowerCase(), momento: ahora };
          const indice = opciones.findIndex(
            (o, i) => !o.deshabilitada && i >= 0 && o.texto.toLowerCase().startsWith(escrito.current.texto)
          );
          if (indice >= 0) {
            if (!abierto) abrir();
            setActivo(indice);
          }
        }
    }
  }

  const sinValor = elegida?.valor === "";

  return (
    <div ref={contenedorRef} className={`selector ${abierto ? "selector-abierto" : ""} ${className}`}>
      <button
        id={id}
        name={name}
        type="button"
        role="combobox"
        className={`selector-boton ${sinValor ? "selector-vacio" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-activedescendant={abierto ? `${idLista}-${activo}` : undefined}
        disabled={disabled}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={alPulsarTecla}
        {...resto}
      >
        <span className="selector-texto">{elegida ? elegida.texto : ""}</span>
        <Icono nombre="abajo" tamano={16} grosor={2.4} />
      </button>

      {abierto && (
        <ul
          ref={listaRef}
          id={idLista}
          role="listbox"
          tabIndex={-1}
          className={`selector-lista ${haciaArriba ? "selector-lista-arriba" : ""}`}
        >
          {opciones.map((opcion, indice) => (
            <li
              key={opcion.valor + indice}
              id={`${idLista}-${indice}`}
              role="option"
              aria-selected={indice === indiceElegido}
              aria-disabled={opcion.deshabilitada || undefined}
              className={[
                "selector-opcion",
                indice === activo ? "selector-opcion-activa" : "",
                indice === indiceElegido ? "selector-opcion-elegida" : "",
                opcion.deshabilitada ? "selector-opcion-deshabilitada" : "",
              ].join(" ")}
              onMouseEnter={() => !opcion.deshabilitada && setActivo(indice)}
              // mousedown (y no click) para elegir antes de que el boton pierda el foco.
              onMouseDown={(evento) => {
                evento.preventDefault();
                elegir(indice);
              }}
            >
              <span>{opcion.texto}</span>
              {indice === indiceElegido && <Icono nombre="check" tamano={16} grosor={2.6} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Selector;
