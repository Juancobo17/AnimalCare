// Logo completo: insignia circular con la huella + nombre.
// Es la misma marca de public/logo.svg, dibujada en React para que use la
// fuente de la app. "claro" es la version para fondos oscuros o fotografias
// y "lema" agrega la frase debajo del nombre.
import Huella from "./Huella";

function Logo({ tamano = 32, claro = false, lema = false }) {
  const fondo = claro ? "#ffffff" : "#258355";
  const huella = claro ? "#258355" : "#ffffff";

  return (
    <span className={`logo ${claro ? "logo-claro" : ""}`} style={{ fontSize: tamano * 0.68 }}>
      <span className="logo-insignia" style={{ width: tamano, height: tamano, backgroundColor: fondo }}>
        <Huella tamano={tamano * 0.62} color={huella} cruz={fondo} />
      </span>
      <span className="logo-texto">
        <span>
          Animal<span className="logo-acento">Care</span>
        </span>
        {lema && <span className="logo-lema">Cuidado veterinario cerca de ti</span>}
      </span>
    </span>
  );
}

export default Logo;
