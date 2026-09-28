import { useEffect, useState } from "react";

// Las fotografias estan en public/imagenes/ y se sirven desde la raiz del sitio.
// Cada escena combina una fotografia con su texto: cambian siempre juntos.
const ESCENAS = [
  {
    id: "mascotas",
    imagen: "/imagenes/mascotas.jpg",
    alt: "Mujer acariciando a sus perros al aire libre",
    titulo: "Cuida a quien más quieres",
    texto: "Registra a tus mascotas y ten siempre a mano su información básica.",
  },
  {
    id: "veterinario",
    imagen: "/imagenes/veterinario.jpg",
    alt: "Veterinaria revisando a un perro con un estetoscopio",
    titulo: "Información lista cuando la necesitas",
    texto: "Consulta los datos de tu mascota en cualquier momento y desde cualquier dispositivo.",
  },
  {
    id: "gato",
    imagen: "/imagenes/gato.jpg",
    alt: "Primer plano de un gato",
    titulo: "Todas tus mascotas en un solo lugar",
    texto: "Perros, gatos y cualquier compañero que forme parte de tu familia.",
  },
  {
    id: "cuidado",
    imagen: "/imagenes/cuidado.jpg",
    alt: "Hombre abrazando a su perro dálmata",
    titulo: "Tu información está protegida",
    texto: "Solo tú puedes ver y modificar la información de tus mascotas.",
  },
];

const MILISEGUNDOS_POR_ESCENA = 5000;

function Carrusel() {
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);

  // Avanza automaticamente. Se detiene mientras el puntero esta encima
  // para que el usuario pueda leer con calma.
  useEffect(() => {
    if (pausado) {
      return;
    }

    const temporizador = setInterval(() => {
      setActual((anterior) => (anterior + 1) % ESCENAS.length);
    }, MILISEGUNDOS_POR_ESCENA);

    // Limpia el temporizador al cambiar de escena o al salir de la pantalla.
    return () => clearInterval(temporizador);
  }, [pausado, actual]);

  return (
    <div
      className="carrusel"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      {ESCENAS.map((escena, indice) => {
        const activa = indice === actual;

        return (
          <div
            key={escena.id}
            className={activa ? "carrusel-escena activa" : "carrusel-escena"}
            aria-hidden={!activa}
          >
            <img
              className="carrusel-imagen"
              src={escena.imagen}
              alt={escena.alt}
              /* La primera imagen es la que se ve al entrar: se prioriza su carga. */
              fetchPriority={indice === 0 ? "high" : "low"}
            />

            <div className="carrusel-texto">
              <h2>{escena.titulo}</h2>
              <p>{escena.texto}</p>
            </div>
          </div>
        );
      })}

      {/* Puntos para saltar directamente a una escena */}
      <div className="carrusel-puntos">
        {ESCENAS.map((escena, indice) => (
          <button
            key={escena.id}
            type="button"
            className={indice === actual ? "carrusel-punto activo" : "carrusel-punto"}
            onClick={() => setActual(indice)}
            aria-label={`Ver imagen ${indice + 1} de ${ESCENAS.length}`}
          />
        ))}
      </div>
    </div>
  );
}

export default Carrusel;
