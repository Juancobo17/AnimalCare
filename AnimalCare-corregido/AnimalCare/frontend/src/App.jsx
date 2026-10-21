import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Veterinarios from "./pages/Veterinarios";
import VeterinarioDetalle from "./pages/VeterinarioDetalle";
import AgendarCita from "./pages/AgendarCita";
import MisCitas from "./pages/MisCitas";
import RutaPrivada from "./components/RutaPrivada";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Al entrar a la raiz, se envia al login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Rutas publicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Rutas privadas: requieren sesion activa */}
        <Route
          path="/dashboard"
          element={
            <RutaPrivada>
              <Dashboard />
            </RutaPrivada>
          }
        />
        <Route
          path="/veterinarios"
          element={
            <RutaPrivada>
              <Veterinarios />
            </RutaPrivada>
          }
        />
        <Route
          path="/veterinarios/:id"
          element={
            <RutaPrivada>
              <VeterinarioDetalle />
            </RutaPrivada>
          }
        />
        <Route
          path="/veterinarios/:id/agendar"
          element={
            <RutaPrivada>
              <AgendarCita />
            </RutaPrivada>
          }
        />
        <Route
          path="/citas"
          element={
            <RutaPrivada>
              <MisCitas />
            </RutaPrivada>
          }
        />

        {/* Cualquier otra direccion vuelve al login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
