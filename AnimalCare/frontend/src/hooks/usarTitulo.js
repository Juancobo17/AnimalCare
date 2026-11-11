// Pone el titulo de la pestaña del navegador segun la pantalla.
// Sin esto todas las pestañas se llaman igual y no se distinguen entre si.
import { useEffect } from "react";

const NOMBRE_APP = "AnimalCare";

export function usarTitulo(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${NOMBRE_APP}` : `${NOMBRE_APP} · Cuidado veterinario`;
  }, [titulo]);
}
