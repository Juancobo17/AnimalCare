// Panel de gestion de usuarios del administrador.
// AN-38 listado y filtros, AN-35 aprobar / rechazar veterinarios,
// AN-37 suspender / reactivar cuentas.
import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import {
  listarUsuarios,
  cambiarEstadoUsuario,
  ESTADOS_CUENTA,
  ROLES,
  ACCIONES,
  accionesDisponibles,
  verTarjetaProfesional,
} from "../services/admin.service";
import { MODALIDADES } from "../services/vet.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

const CLASE_ESTADO = {
  PENDING: "etiqueta-pending",
  ACTIVE: "etiqueta-confirmed",
  SUSPENDED: "etiqueta-cancelled",
  REJECTED: "etiqueta-cancelled",
};

function formatearFechaRegistro(fecha) {
  return new Date(fecha).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function AdminUsuarios() {
  // El filtro de estado puede venir en la URL (?estado=PENDING) desde el panel principal.
  const [parametros] = useSearchParams();
  const [estado, setEstado] = useState(parametros.get("estado") || "");
  const [rol, setRol] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);

  const [usuarios, setUsuarios] = useState([]);
  const [conteos, setConteos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);
  const [sinConexion, setSinConexion] = useState(false);
  const [intento, setIntento] = useState(0);

  const [detalle, setDetalle] = useState(null);
  const [pendiente, setPendiente] = useState(null); // { usuario, accion }
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      try {
        const datos = await listarUsuarios({ status: estado, role: rol, q: busqueda.trim(), page: pagina });
        if (!cancelado) {
          setUsuarios(datos.users);
          setConteos(datos.counts);
          setTotal(datos.total);
          setTotalPaginas(datos.totalPages);
          setErrores([]);
          setSinConexion(false);
        }
      } catch (error) {
        if (!cancelado) {
          setErrores(obtenerMensajesDeError(error));
          setSinConexion(esErrorDeConexion(error));
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    const temporizador = setTimeout(cargar, 300);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [estado, rol, busqueda, pagina, intento]);

  // Al cambiar un filtro se vuelve a la primera pagina.
  useEffect(() => {
    setPagina(1);
  }, [estado, rol, busqueda]);

  async function abrirTarjeta(usuario) {
    setErrores([]);
    try {
      await verTarjetaProfesional(usuario.id);
    } catch {
      setErrores([`No se pudo abrir la tarjeta profesional de ${usuario.name}.`]);
    }
  }

  async function confirmarAccion() {
    setProcesando(true);
    setErrores([]);
    setExito([]);
    try {
      const resultado = await cambiarEstadoUsuario(pendiente.usuario.id, pendiente.accion);
      setExito([`${pendiente.usuario.name}: ${resultado.message}`]);
      setIntento((n) => n + 1);
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setProcesando(false);
      setPendiente(null);
    }
  }

  const totalGeneral = conteos ? Object.values(conteos).reduce((a, b) => a + b, 0) : null;
  const pestanas = [
    { valor: "", texto: "Todos", total: totalGeneral },
    ...Object.keys(ESTADOS_CUENTA).map((clave) => ({
      valor: clave,
      texto: `${ESTADOS_CUENTA[clave]}s`,
      total: conteos ? conteos[clave] : null,
    })),
  ];

  return (
    <div className="pagina">
      <Cabecera />

      <main className="contenedor contenedor-ancho">
        <div className="tarjeta">
          <h1>Gestión de usuarios</h1>
          <p className="texto-suave">
            Revisa los registros de veterinarios, aprueba o rechaza solicitudes y suspende las cuentas
            que incumplan las normas.
          </p>

          <div className="pestanas" role="tablist">
            {pestanas.map((pestana) => (
              <button
                key={pestana.valor || "todos"}
                type="button"
                role="tab"
                aria-selected={estado === pestana.valor}
                className={`pestana ${estado === pestana.valor ? "pestana-activa" : ""}`}
                onClick={() => setEstado(pestana.valor)}
              >
                {pestana.texto}
                {pestana.total !== null && <span className="pestana-total">{pestana.total}</span>}
              </button>
            ))}
          </div>

          <div className="filtros">
            <div className="campo">
              <label htmlFor="admin-busqueda">Buscar</label>
              <input
                id="admin-busqueda"
                type="search"
                maxLength={60}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre o correo"
              />
            </div>
            <div className="campo">
              <label htmlFor="admin-rol">Rol</label>
              <select id="admin-rol" value={rol} onChange={(e) => setRol(e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(ROLES).map(([clave, texto]) => (
                  <option key={clave} value={clave}>
                    {texto}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <Alerta tipo="exito" mensajes={exito} />
        <Alerta
          tipo="error"
          mensajes={errores}
          onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined}
        />

        {pendiente && (
          <div className="modal-fondo" role="presentation">
            <div className="modal tarjeta" role="alertdialog" aria-modal="true" aria-labelledby="modal-titulo">
              <h3 id="modal-titulo">{ACCIONES[pendiente.accion].boton} cuenta</h3>
              <p>
                <strong>{pendiente.usuario.name}</strong> ({pendiente.usuario.email})
              </p>
              <p>{ACCIONES[pendiente.accion].pregunta}</p>
              <div className="acciones-linea">
                <button
                  type="button"
                  className={`boton ${ACCIONES[pendiente.accion].clase} boton-auto`}
                  onClick={confirmarAccion}
                  disabled={procesando}
                >
                  {procesando ? "Procesando..." : `Sí, ${ACCIONES[pendiente.accion].boton.toLowerCase()}`}
                </button>
                <button
                  type="button"
                  className="boton boton-secundario boton-auto"
                  onClick={() => setPendiente(null)}
                  disabled={procesando}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="tarjeta">
          {cargando && <p className="texto-suave">Cargando usuarios...</p>}

          {!cargando && usuarios.length === 0 && errores.length === 0 && (
            <p className="texto-suave">No se encontraron usuarios con estos criterios</p>
          )}

          {usuarios.length > 0 && (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>Registro</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((usuario) => (
                    <Fragment key={usuario.id}>
                      <tr>
                        <td>
                          <strong>{usuario.name}</strong>
                          <div className="texto-suave">{usuario.email}</div>
                        </td>
                        <td data-etiqueta="Rol">{ROLES[usuario.role]}</td>
                        <td data-etiqueta="Registro">{formatearFechaRegistro(usuario.createdAt)}</td>
                        <td data-etiqueta="Estado">
                          <span className={`etiqueta ${CLASE_ESTADO[usuario.status]}`}>
                            {ESTADOS_CUENTA[usuario.status]}
                          </span>
                        </td>
                        <td>
                          <div className="acciones-linea">
                            {usuario.vetProfile?.hasLicenseDoc && (
                              <button
                                type="button"
                                className="boton boton-secundario boton-auto"
                                onClick={() => abrirTarjeta(usuario)}
                              >
                                Ver tarjeta
                              </button>
                            )}
                            {usuario.vetProfile && (
                              <button
                                type="button"
                                className="boton boton-secundario boton-auto"
                                aria-expanded={detalle === usuario.id}
                                onClick={() => setDetalle(detalle === usuario.id ? null : usuario.id)}
                              >
                                {detalle === usuario.id ? "Ocultar datos" : "Ver datos"}
                              </button>
                            )}
                            {accionesDisponibles(usuario).map((accion) => (
                              <button
                                key={accion}
                                type="button"
                                className={`boton ${ACCIONES[accion].clase} boton-auto`}
                                onClick={() => setPendiente({ usuario, accion })}
                              >
                                {ACCIONES[accion].boton}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                      {detalle === usuario.id && usuario.vetProfile && (
                        <tr className="tabla-detalle">
                          <td colSpan={5}>
                            <dl className="datos">
                              <div>
                                <dt>Matrícula</dt>
                                <dd>{usuario.vetProfile.license}</dd>
                              </div>
                              <div>
                                <dt>Especialidad</dt>
                                <dd>{usuario.vetProfile.specialty}</dd>
                              </div>
                              <div>
                                <dt>Teléfono</dt>
                                <dd>{usuario.vetProfile.phone || "—"}</dd>
                              </div>
                              <div>
                                <dt>Modalidades</dt>
                                <dd>
                                  {[
                                    usuario.vetProfile.clinicService ? MODALIDADES.CLINIC : null,
                                    usuario.vetProfile.homeService ? MODALIDADES.HOME : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </dd>
                              </div>
                              {usuario.vetProfile.address && (
                                <div>
                                  <dt>Dirección</dt>
                                  <dd>{usuario.vetProfile.address}</dd>
                                </div>
                              )}
                            </dl>
                            {usuario.vetProfile.bio && <p className="texto-presentacion">{usuario.vetProfile.bio}</p>}
                            {!usuario.vetProfile.hasLicenseDoc && (
                              <p className="texto-suave">Aún no ha cargado su tarjeta profesional.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPaginas > 1 && (
            <nav className="paginacion" aria-label="Páginas">
              <button
                type="button"
                className="boton boton-secundario boton-auto"
                disabled={pagina <= 1}
                onClick={() => setPagina((n) => n - 1)}
              >
                ‹ Anterior
              </button>
              <span className="texto-suave">
                Página {pagina} de {totalPaginas} · {total} usuarios
              </span>
              <button
                type="button"
                className="boton boton-secundario boton-auto"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((n) => n + 1)}
              >
                Siguiente ›
              </button>
            </nav>
          )}
        </div>
      </main>
    </div>
  );
}

export default AdminUsuarios;
