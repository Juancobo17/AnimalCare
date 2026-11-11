// Perfil del veterinario: foto, datos públicos y tarjeta profesional.
// La matrícula y el correo no se editan aquí (identifican la cuenta).
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import Cabecera from "../components/Cabecera";
import Alerta from "../components/Alerta";
import FotoVeterinario from "../components/FotoVeterinario";
import {
  obtenerMiPerfil,
  guardarMiPerfil,
  subirFoto,
  quitarFoto,
  subirTarjetaProfesional,
  leerArchivo,
} from "../services/vetPanel.service";
import { obtenerMensajesDeError, esErrorDeConexion } from "../services/api";

const MAX_FOTO_MB = 3;
const MAX_DOC_MB = 5;

function MiPerfil() {
  const [perfil, setPerfil] = useState(null);
  const [datos, setDatos] = useState(null);
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);
  const [sinConexion, setSinConexion] = useState(false);
  const [intento, setIntento] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState("");
  const entradaFoto = useRef(null);
  const entradaDoc = useRef(null);

  useEffect(() => {
    obtenerMiPerfil()
      .then((p) => {
        setPerfil(p);
        setDatos({
          specialty: p.specialty,
          bio: p.bio || "",
          phone: p.phone || "",
          address: p.address || "",
          homeService: p.homeService,
          clinicService: p.clinicService,
        });
        setErrores([]);
        setSinConexion(false);
      })
      .catch((error) => {
        setErrores(obtenerMensajesDeError(error));
        setSinConexion(esErrorDeConexion(error));
      });
  }, [intento]);

  function cambiar(e) {
    const { name, value, type, checked } = e.target;
    setDatos((a) => ({ ...a, [name]: type === "checkbox" ? checked : value }));
  }

  async function guardar(e) {
    e.preventDefault();
    setErrores([]);
    setExito([]);
    setGuardando(true);
    try {
      const r = await guardarMiPerfil(datos);
      setPerfil(r.profile);
      setExito([r.message]);
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setGuardando(false);
    }
  }

  // Valida tipo y tamaño en el navegador antes de enviar (el backend vuelve a validar).
  async function elegirArchivo(evento, { tipos, maxMb, tipo }) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    setErrores([]);
    setExito([]);
    if (!tipos.includes(archivo.type)) {
      setErrores([`Formato no permitido. Usa: ${tipos.map((t) => t.split("/")[1].toUpperCase()).join(", ")}.`]);
      return;
    }
    if (archivo.size > maxMb * 1024 * 1024) {
      setErrores([`El archivo no puede pesar más de ${maxMb} MB.`]);
      return;
    }
    setSubiendo(tipo);
    try {
      const dataUrl = await leerArchivo(archivo);
      if (tipo === "foto") {
        const r = await subirFoto(dataUrl);
        setPerfil((p) => ({ ...p, photoUrl: r.photoUrl }));
        setExito([r.message]);
      } else {
        const r = await subirTarjetaProfesional(dataUrl);
        setPerfil((p) => ({ ...p, hasLicenseDoc: true }));
        setExito([r.message]);
      }
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setSubiendo("");
    }
  }

  async function borrarFoto() {
    setErrores([]);
    try {
      const r = await quitarFoto();
      setPerfil((p) => ({ ...p, photoUrl: null }));
      setExito([r.message]);
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    }
  }

  return (
    <div className="pagina">
      <Cabecera />
      <main className="contenedor">
        <div className="tarjeta">
          <h1>Mi perfil</h1>
          <p className="texto-suave">
            Esto es lo que ven los dueños de mascotas en tu perfil público.
            {perfil?.status === "ACTIVE" && (
              <>
                {" "}
                <Link to="/mis-servicios">Gestiona tus servicios</Link> y{" "}
                <Link to="/mi-horario">tu horario</Link> por separado.
              </>
            )}
          </p>
        </div>

        <Alerta tipo="exito" mensajes={exito} />
        <Alerta tipo="error" mensajes={errores} onReintentar={sinConexion ? () => setIntento((n) => n + 1) : undefined} />

        {!perfil && errores.length === 0 && <p className="texto-suave">Cargando perfil...</p>}

        {perfil && datos && (
          <>
            <div className="tarjeta">
              <h3>Foto de perfil</h3>
              <div className="foto-editor">
                <FotoVeterinario nombre={perfil.name} url={perfil.photoUrl} tamano={96} />
                <div>
                  <p className="texto-suave">JPG, PNG o WEBP, hasta {MAX_FOTO_MB} MB. Una foto cercana y con buena luz genera más confianza.</p>
                  <div className="acciones-linea">
                    <input
                      ref={entradaFoto}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      hidden
                      onChange={(e) =>
                        elegirArchivo(e, { tipos: ["image/jpeg", "image/png", "image/webp"], maxMb: MAX_FOTO_MB, tipo: "foto" })
                      }
                    />
                    <button
                      type="button"
                      className="boton boton-primario boton-auto"
                      disabled={subiendo === "foto"}
                      onClick={() => entradaFoto.current?.click()}
                    >
                      {subiendo === "foto" ? "Subiendo..." : perfil.photoUrl ? "Cambiar foto" : "Subir foto"}
                    </button>
                    {perfil.photoUrl && (
                      <button type="button" className="boton boton-secundario boton-auto" onClick={borrarFoto}>
                        Quitar foto
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="tarjeta">
              <h3>Tarjeta profesional</h3>
              <p className="texto-suave">
                {perfil.hasLicenseDoc
                  ? "✓ Ya cargaste tu tarjeta profesional. Solo el administrador puede verla."
                  : perfil.status === "PENDING"
                    ? "Sube una foto o PDF de tu tarjeta profesional para que el administrador pueda verificar tu matrícula más rápido."
                    : "Puedes cargar tu tarjeta profesional. Solo el administrador puede verla."}
              </p>
              <input
                ref={entradaDoc}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                hidden
                onChange={(e) =>
                  elegirArchivo(e, { tipos: ["application/pdf", "image/jpeg", "image/png"], maxMb: MAX_DOC_MB, tipo: "doc" })
                }
              />
              <button
                type="button"
                className={`boton boton-auto ${perfil.hasLicenseDoc ? "boton-secundario" : "boton-primario"}`}
                disabled={subiendo === "doc"}
                onClick={() => entradaDoc.current?.click()}
              >
                {subiendo === "doc" ? "Subiendo..." : perfil.hasLicenseDoc ? "Reemplazar archivo" : "Subir tarjeta profesional"}
              </button>
              <span className="ayuda">PDF, JPG o PNG, hasta {MAX_DOC_MB} MB.</span>
            </div>

            <form className="tarjeta" onSubmit={guardar} noValidate>
              <h3>Datos públicos</h3>
              <dl className="datos">
                <div>
                  <dt>Nombre</dt>
                  <dd>{perfil.name}</dd>
                </div>
                <div>
                  <dt>Correo</dt>
                  <dd>{perfil.email}</dd>
                </div>
                <div>
                  <dt>Matrícula</dt>
                  <dd>{perfil.license}</dd>
                </div>
              </dl>
              <div className="fila">
                <div className="campo">
                  <label htmlFor="specialty">
                    Especialidad <span className="obligatorio">*</span>
                  </label>
                  <input id="specialty" name="specialty" maxLength={60} value={datos.specialty} onChange={cambiar} />
                </div>
                <div className="campo">
                  <label htmlFor="phone">Teléfono de contacto</label>
                  <input id="phone" name="phone" maxLength={15} value={datos.phone} onChange={cambiar} />
                </div>
              </div>
              <div className="campo">
                <label htmlFor="bio">Presentación</label>
                <textarea id="bio" name="bio" rows={3} maxLength={500} value={datos.bio} onChange={cambiar} />
                <span className="ayuda">{datos.bio.length}/500</span>
              </div>
              <fieldset className="grupo-casillas">
                <legend>
                  Modalidades de atención <span className="obligatorio">*</span>
                </legend>
                <label className="casilla">
                  <input type="checkbox" name="clinicService" checked={datos.clinicService} onChange={cambiar} />
                  Atiendo en mi veterinaria
                </label>
                <label className="casilla">
                  <input type="checkbox" name="homeService" checked={datos.homeService} onChange={cambiar} />
                  Atiendo a domicilio
                </label>
              </fieldset>
              <div className="campo">
                <label htmlFor="address">
                  Dirección del consultorio {datos.clinicService && <span className="obligatorio">*</span>}
                </label>
                <input
                  id="address"
                  name="address"
                  maxLength={150}
                  value={datos.address}
                  onChange={cambiar}
                  placeholder="Calle 10 # 5-20, barrio Centro, Popayán"
                />
                <span className="ayuda">Incluye el barrio y la ciudad: así te encuentran al filtrar por zona.</span>
              </div>
              <button type="submit" className="boton boton-primario boton-auto" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

export default MiPerfil;
