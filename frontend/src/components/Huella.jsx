// Icono de huella usado como logo de AnimalCare.
// Es un SVG propio para no depender de librerias de iconos.
function Huella({ tamano = 32, color = "currentColor" }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
    >
      <ellipse cx="6.5" cy="9.5" rx="2.2" ry="2.9" />
      <ellipse cx="17.5" cy="9.5" rx="2.2" ry="2.9" />
      <ellipse cx="10" cy="5.2" rx="2" ry="2.6" />
      <ellipse cx="14" cy="5.2" rx="2" ry="2.6" />
      <path d="M12 12.5c-2.6 0-4.8 1.9-5.4 4.3-.5 2 1 3.7 3 3.7 .9 0 1.7-.3 2.4-.3s1.5.3 2.4.3c2 0 3.5-1.7 3-3.7-.6-2.4-2.8-4.3-5.4-4.3z" />
    </svg>
  );
}

export default Huella;
