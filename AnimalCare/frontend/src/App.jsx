import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import RutaPrivada from "./components/RutaPrivada";
import { ToastProvider } from "./components/ToastProvider";

// El resto de pantallas se descarga solo cuando se visitan: el login y el inicio cargan mas rapido.
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Veterinarios = lazy(() => import("./pages/Veterinarios"));
const VeterinarioDetalle = lazy(() => import("./pages/VeterinarioDetalle"));
const AgendarCita = lazy(() => import("./pages/AgendarCita"));
const MisCitas = lazy(() => import("./pages/MisCitas"));
const MisServicios = lazy(() => import("./pages/MisServicios"));
const MiHorario = lazy(() => import("./pages/MiHorario"));
const AdminUsuarios = lazy(() => import("./pages/AdminUsuarios"));
const NotificacionesPagina = lazy(() => import("./pages/NotificacionesPagina"));
const MisMascotas = lazy(() => import("./pages/MisMascotas"));
const MiPerfil = lazy(() => import("./pages/MiPerfil"));
const HistoriaClinica = lazy(() => import("./pages/HistoriaClinica"));
const RecuperarContrasena = lazy(() => import("./pages/RecuperarContrasena"));
const RestablecerContrasena = lazy(() => import("./pages/RestablecerContrasena"));
const VerificarCorreo = lazy(() => import("./pages/VerificarCorreo"));
const MiCuenta = lazy(() => import("./pages/MiCuenta"));
const Privacidad = lazy(() => import("./pages/Privacidad"));
const Urgencias = lazy(() => import("./pages/Urgencias"));

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <Suspense fallback={<div className="pagina pagina-cargando" role="status" aria-label="Cargando" />}>
      <Routes>
        {/* Al entrar a la raiz, se envia al login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Rutas publicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/recuperar" element={<RecuperarContrasena />} />
        <Route path="/restablecer" element={<RestablecerContrasena />} />
        <Route path="/verificar-correo" element={<VerificarCorreo />} />
        <Route path="/privacidad" element={<Privacidad />} />

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

        <Route
          path="/mi-cuenta"
          element={
            <RutaPrivada>
              <MiCuenta />
            </RutaPrivada>
          }
        />

        {/* Urgencias: lo que AN-23 llamaba emergencias */}
        <Route
          path="/urgencias"
          element={
            <RutaPrivada roles={["CLIENT", "VETERINARIAN"]}>
              <Urgencias />
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
      </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
