// Protege las rutas privadas del frontend.
// Si no hay sesion activa, redirige al login. Si se indican roles y el
// usuario no tiene uno de ellos, lo devuelve a su panel.
//
// Nota: esta proteccion es de usabilidad. La seguridad real esta en el
// backend, que rechaza con 401 o 403 cualquier peticion no permitida.
import { Navigate } from "react-router-dom";

import { haySesionActiva, obtenerUsuario } from "../services/auth.service";

function RutaPrivada({ children, roles }) {
  if (!haySesionActiva()) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(obtenerUsuario()?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default RutaPrivada;
