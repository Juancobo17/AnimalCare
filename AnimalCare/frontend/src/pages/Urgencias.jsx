// Urgencias (lo que AN-23 llamaba "emergencias").
// El dueño pide atencion urgente; el veterinario de turno la acepta.
import Cabecera from "../components/Cabecera";
import UrgenciaCliente from "../components/UrgenciaCliente";
import UrgenciaVeterinario from "../components/UrgenciaVeterinario";
import { obtenerUsuario } from "../services/auth.service";

function Urgencias() {
  const esVeterinario = obtenerUsuario()?.role === "VETERINARIAN";

  return (
    <div className="pagina">
      <Cabecera />
      <main className="contenedor">{esVeterinario ? <UrgenciaVeterinario /> : <UrgenciaCliente />}</main>
    </div>
  );
}

export default Urgencias;
