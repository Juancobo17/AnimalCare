// Simbolo de AnimalCare: una huella cuya almohadilla principal tiene forma
// de corazon, con la cruz veterinaria en el centro.
// "cruz" es el color de la cruz; conviene que sea el color del fondo.
// Pasa cruz={null} para dibujar solo la huella.
function Huella({ tamano = 32, color = "#258355", cruz = "#ffffff" }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g fill={color}>
        <ellipse cx="10.5" cy="25" rx="5" ry="6.8" transform="rotate(-24 10.5 25)" />
        <ellipse cx="23.5" cy="13.5" rx="5.5" ry="7.4" transform="rotate(-8 23.5 13.5)" />
        <ellipse cx="40.5" cy="13.5" rx="5.5" ry="7.4" transform="rotate(8 40.5 13.5)" />
        <ellipse cx="53.5" cy="25" rx="5" ry="6.8" transform="rotate(24 53.5 25)" />
        <path d="M32 59C20.5 51.5 15 45.5 15 39.2 15 33.6 19.3 30 24 30c3.4 0 6.2 1.8 8 4.4 1.8-2.6 4.6-4.4 8-4.4 4.7 0 9 3.6 9 9.2 0 6.3-5.5 12.3-17 19.8z" />
      </g>
      {cruz && <path d="M30.2 36.5h3.6v4.3h4.3v3.6h-4.3v4.3h-3.6v-4.3h-4.3v-3.6h4.3z" fill={cruz} />}
    </svg>
  );
}

export default Huella;
