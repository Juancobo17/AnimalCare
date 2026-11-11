import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Veterinarios from "./pages/Veterinarios";
import VeterinarioDetalle from "./pages/VeterinarioDetalle";
import AgendarCita from "./pages/AgendarCita";
import MisCitas from "./pages/MisCitas";
import MisServicios from "./pages/MisServicios";
import MiHorario from "./pages/MiHorario";
import AdminUsuarios from "./pages/AdminUsuarios";
import NotificacionesPagina from "./pages/NotificacionesPagina";
import MisMascotas from "./pages/MisMascotas";
import MiPerfil from "./pages/MiPerfil";
import HistoriaClinica from "./pages/HistoriaClinica";
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
            <RutaPrivada roles={["CLIENT"]}>
              <Veterinarios />
            </RutaPrivada>
          }
        />
        <Route
          path="/veterinarios/:id"
          element={
            <RutaPrivada roles={["CLIENT"]}>
              <VeterinarioDetalle />
            </RutaPrivada>
          }
        />
        <Route
          path="/veterinarios/:id/agendar"
          element={
            <RutaPrivada roles={["CLIENT"]}>
              <AgendarCita />
            </RutaPrivada>
          }
        />
        <Route
          path="/citas"
          element={
            <RutaPrivada roles={["CLIENT", "VETERINARIAN"]}>
              <MisCitas />
            </RutaPrivada>
          }
        />

        {/* Panel del veterinario: AN-28, AN-29, AN-30 y AN-31 */}
        <Route
          path="/mis-servicios"
          element={
            <RutaPrivada roles={["VETERINARIAN"]}>
              <MisServicios />
            </RutaPrivada>
          }
        />
        <Route
          path="/mi-horario"
          element={
            <RutaPrivada roles={["VETERINARIAN"]}>
              <MiHorario />
            </RutaPrivada>
          }
        />

        <Route
          path="/mascotas"
          element={
            <RutaPrivada roles={["CLIENT"]}>
              <MisMascotas />
            </RutaPrivada>
          }
        />
        {/* Historias clinicas: AN-21 (dueño) y AN-18, AN-19, AN-20 (veterinario) */}
        <Route
          path="/mascotas/:id/historia"
          element={
            <RutaPrivada roles={["CLIENT"]}>
              <HistoriaClinica />
            </RutaPrivada>
          }
        />
        <Route
          path="/pacientes/:id"
          element={
            <RutaPrivada roles={["VETERINARIAN"]}>
              <HistoriaClinica />
            </RutaPrivada>
          }
        />
        <Route
          path="/mi-perfil"
          element={
            <RutaPrivada roles={["VETERINARIAN"]}>
              <MiPerfil />
            </RutaPrivada>
          }
        />

        {/* AN-22 y AN-23 */}
        <Route
          path="/notificaciones"
          element={
            <RutaPrivada roles={["CLIENT", "VETERINARIAN"]}>
              <NotificacionesPagina />
            </RutaPrivada>
          }
        />

        {/* Administrador: AN-35, AN-37 y AN-38 */}
        <Route
          path="/admin/usuarios"
          element={
            <RutaPrivada roles={["ADMIN"]}>
              <AdminUsuarios />
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
