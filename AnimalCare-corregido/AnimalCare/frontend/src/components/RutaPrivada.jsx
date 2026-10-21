// Protege las rutas privadas del frontend.
// Si no hay sesion activa, redirige al login.
//
// Nota: esta proteccion es de usabilidad. La seguridad real esta en el
// backend, que rechaza con 401 cualquier peticion sin un JWT valido.
import { Navigate } from "react-router-dom";

import { haySesionActiva } from "../services/auth.service";

function RutaPrivada({ children }) {
  if (!haySesionActiva()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default RutaPrivada;
