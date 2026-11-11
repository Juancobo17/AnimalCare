// Icono de la especie de una mascota (reemplaza a los emojis).
// Usa lucide-react: se importa solo cada icono, asi que pesa muy poco.
import { Dog, Cat, Bird, Rabbit, Rat, Turtle, PawPrint } from "lucide-react";

const ICONOS = {
  Perro: Dog,
  Gato: Cat,
  Ave: Bird,
  Conejo: Rabbit,
  Roedor: Rat,
  Reptil: Turtle,
};

function IconoEspecie({ especie, tamano = 20 }) {
  const Componente = ICONOS[especie] || PawPrint;
  return <Componente className="icono-especie" size={tamano} strokeWidth={1.8} aria-hidden="true" focusable="false" />;
}

export default IconoEspecie;
