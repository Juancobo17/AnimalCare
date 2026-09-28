import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "../components/AuthLayout";
import Alerta from "../components/Alerta";
import { registrar } from "../services/auth.service";
import { obtenerMensajesDeError } from "../services/api";

const LARGO_MINIMO_CONTRASENA = 6;
const MAXIMO_SERVICIOS = 10;

// Fila vacia del catalogo de servicios del veterinario.
const SERVICIO_VACIO = { name: "", price: "", durationMinutes: "30" };

// Duraciones que ofrece el formulario. Coinciden con los bloques de la agenda.
const DURACIONES = [15, 30, 45, 60, 90, 120];

function Register() {
  const navigate = useNavigate();

  // AN-6 registra un cliente y AN-7 un veterinario: es el mismo formulario
  // con un bloque extra de datos profesionales.
  const [rol, setRol] = useState("CLIENT");

  const [datos, setDatos] = useState({
    name: "",
    email: "",
    password: "",
    license: "",
    specialty: "",
    phone: "",
    address: "",
    bio: "",
    homeService: false,
    clinicService: true,
  });

  const [servicios, setServicios] = useState([{ ...SERVICIO_VACIO }]);
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState([]);
  const [enviando, setEnviando] = useState(false);

  const esVeterinario = rol === "VETERINARIAN";

  function manejarCambio(evento) {
    const { name, value, type, checked } = evento.target;
    setDatos((anterior) => ({
      ...anterior,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function manejarCambioServicio(indice, campo, valor) {
    setServicios((anterior) =>
      anterior.map((servicio, posicion) =>
        posicion === indice ? { ...servicio, [campo]: valor } : servicio
      )
    );
  }

  function agregarServicio() {
    if (servicios.length >= MAXIMO_SERVICIOS) {
      return;
    }
    setServicios((anterior) => [...anterior, { ...SERVICIO_VACIO }]);
  }

  function quitarServicio(indice) {
    setServicios((anterior) => anterior.filter((_, posicion) => posicion !== indice));
  }

  // Mismas reglas que valida el backend en auth.controller.js.
  function validar() {
    const mensajes = [];

    if (datos.name.trim() === "") {
      mensajes.push("El nombre es obligatorio.");
    }

    if (datos.email.trim() === "") {
      mensajes.push("El correo es obligatorio.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) {
      mensajes.push("El correo no tiene un formato válido.");
    }

    if (datos.password.trim() === "") {
      mensajes.push("La contraseña es obligatoria.");
    } else if (datos.password.length < LARGO_MINIMO_CONTRASENA) {
      mensajes.push(`La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`);
    }

    if (!esVeterinario) {
      return mensajes;
    }

    // --- Datos profesionales (AN-7) ---

    if (datos.license.trim() === "") {
      mensajes.push("El número de matrícula es obligatorio.");
    } else if (!/^[A-Za-z0-9-]{4,30}$/.test(datos.license.trim())) {
      mensajes.push("La matrícula debe tener entre 4 y 30 caracteres, sin espacios ni símbolos.");
    }

    if (datos.specialty.trim() === "") {
      mensajes.push("La especialidad es obligatoria.");
    } else if (datos.specialty.trim().length < 3) {
      mensajes.push("La especialidad debe tener al menos 3 caracteres.");
    }

    // Al menos una modalidad de atención (AN-10 / AN-11).
    if (!datos.homeService && !datos.clinicService) {
      mensajes.push("Debes ofrecer al menos una modalidad de atención.");
    }

    if (datos.clinicService && datos.address.trim() === "") {
      mensajes.push("La dirección del consultorio es obligatoria si atiendes en la veterinaria.");
    }

    servicios.forEach((servicio, indice) => {
      const nombre = servicio.name.trim();
      const precio = servicio.price.trim();

      // Una fila vacía simplemente no se envía.
      if (nombre === "" && precio === "") {
        return;
      }

      if (nombre === "") {
        mensajes.push(`El servicio ${indice + 1} necesita un nombre.`);
      }
      if (precio === "" || Number.isNaN(Number(precio)) || Number(precio) <= 0) {
        mensajes.push(`El precio del servicio ${indice + 1} debe ser un número mayor que cero.`);
      }
    });

    return mensajes;
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();

    const mensajes = validar();
    if (mensajes.length > 0) {
      setExito([]);
      setErrores(mensajes);
      return;
    }

    setErrores([]);
    setEnviando(true);

    try {
      const cuerpo = {
        name: datos.name.trim(),
        email: datos.email.trim(),
        password: datos.password,
        role: rol,
      };

      if (esVeterinario) {
        cuerpo.license = datos.license.trim();
        cuerpo.specialty = datos.specialty.trim();
        cuerpo.phone = datos.phone.trim();
        cuerpo.address = datos.address.trim();
        cuerpo.bio = datos.bio.trim();
        cuerpo.homeService = datos.homeService;
        cuerpo.clinicService = datos.clinicService;
        cuerpo.services = servicios
          .filter((servicio) => servicio.name.trim() !== "" || servicio.price.trim() !== "")
          .map((servicio) => ({
            name: servicio.name.trim(),
            price: servicio.price.trim(),
            durationMinutes: Number(servicio.durationMinutes),
          }));
      }

      await registrar(cuerpo);

      setExito([
        esVeterinario
          ? "Tu cuenta profesional fue creada. Ya puedes iniciar sesión."
          : "Tu cuenta fue creada correctamente. Ya puedes iniciar sesión.",
      ]);

      // Lleva al login para que la persona entre con sus credenciales.
      setTimeout(() => navigate("/login"), 1800);
    } catch (error) {
      setErrores(obtenerMensajesDeError(error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout ancho={esVeterinario}>
      <h1>Crear cuenta</h1>
      <p className="auth-subtitulo">
        Elige cómo quieres usar AnimalCare. Podrás cambiar de cuenta cuando quieras.
      </p>

      <Alerta tipo="exito" mensajes={exito} />
      <Alerta tipo="error" mensajes={errores} />

      <form onSubmit={manejarEnvio} noValidate>
        {/* Tipo de cuenta: AN-6 (cliente) o AN-7 (veterinario) */}
        <fieldset className="selector-rol">
          <legend>Quiero registrarme como</legend>

          <label className={`opcion-rol ${rol === "CLIENT" ? "activa" : ""}`}>
            <input
              type="radio"
              name="rol"
              value="CLIENT"
              checked={rol === "CLIENT"}
              onChange={() => setRol("CLIENT")}
            />
            <span className="opcion-rol-titulo">Cliente</span>
            <span className="opcion-rol-texto">Quiero agendar citas para mis mascotas.</span>
          </label>

          <label className={`opcion-rol ${esVeterinario ? "activa" : ""}`}>
            <input
              type="radio"
              name="rol"
              value="VETERINARIAN"
              checked={esVeterinario}
              onChange={() => setRol("VETERINARIAN")}
            />
            <span className="opcion-rol-titulo">Veterinario</span>
            <span className="opcion-rol-texto">Quiero ofrecer mis servicios profesionales.</span>
          </label>
        </fieldset>

        <div className="campo">
          <label htmlFor="name">
            Nombre completo <span className="obligatorio">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={datos.name}
            onChange={manejarCambio}
            placeholder={esVeterinario ? "Dra. Ana Torres" : "Ana Torres"}
            autoComplete="name"
          />
        </div>

        <div className="campo">
          <label htmlFor="email">
            Correo electrónico <span className="obligatorio">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={datos.email}
            onChange={manejarCambio}
            placeholder="tucorreo@ejemplo.com"
            autoComplete="email"
          />
        </div>

        <div className="campo">
          <label htmlFor="password">
            Contraseña <span className="obligatorio">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={datos.password}
            onChange={manejarCambio}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
          <span className="ayuda">Debe tener al menos {LARGO_MINIMO_CONTRASENA} caracteres.</span>
        </div>

        {/* Bloque profesional: solo aplica al registro de veterinarios (AN-7) */}
        {esVeterinario && (
          <>
            <h3 className="titulo-seccion">Datos profesionales</h3>

            <div className="fila">
              <div className="campo">
                <label htmlFor="license">
                  Número de matrícula <span className="obligatorio">*</span>
                </label>
                <input
                  id="license"
                  name="license"
                  type="text"
                  value={datos.license}
                  onChange={manejarCambio}
                  placeholder="MV-12345"
                />
              </div>

              <div className="campo">
                <label htmlFor="specialty">
                  Especialidad <span className="obligatorio">*</span>
                </label>
                <input
                  id="specialty"
                  name="specialty"
                  type="text"
                  value={datos.specialty}
                  onChange={manejarCambio}
                  placeholder="Medicina general"
                />
              </div>
            </div>

            <div className="campo">
              <label htmlFor="phone">Teléfono de contacto</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={datos.phone}
                onChange={manejarCambio}
                placeholder="3001234567"
              />
            </div>

            <div className="campo">
              <label htmlFor="bio">Presentación</label>
              <textarea
                id="bio"
                name="bio"
                rows={3}
                value={datos.bio}
                onChange={manejarCambio}
                placeholder="Cuéntales a tus clientes sobre tu experiencia."
              />
              <span className="ayuda">Aparecerá en tu perfil público. Máximo 500 caracteres.</span>
            </div>

            {/* Modalidades de atención: AN-10 (domicilio) y AN-11 (veterinaria) */}
            <fieldset className="grupo-casillas">
              <legend>
                Modalidades de atención <span className="obligatorio">*</span>
              </legend>

              <label className="casilla">
                <input
                  type="checkbox"
                  name="clinicService"
                  checked={datos.clinicService}
                  onChange={manejarCambio}
                />
                <span>Atiendo en mi veterinaria</span>
              </label>

              <label className="casilla">
                <input
                  type="checkbox"
                  name="homeService"
                  checked={datos.homeService}
                  onChange={manejarCambio}
                />
                <span>Atiendo a domicilio</span>
              </label>
            </fieldset>

            {datos.clinicService && (
              <div className="campo">
                <label htmlFor="address">
                  Dirección del consultorio <span className="obligatorio">*</span>
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  value={datos.address}
                  onChange={manejarCambio}
                  placeholder="Calle 10 # 5-20"
                />
              </div>
            )}

            <h3 className="titulo-seccion">Servicios que ofreces</h3>
            <p className="ayuda ayuda-bloque">
              Los verán tus clientes en tu perfil. Puedes dejarlos vacíos y agregarlos después.
            </p>

            {servicios.map((servicio, indice) => (
              <div className="servicio-fila" key={indice}>
                <div className="campo">
                  <label htmlFor={`servicio-nombre-${indice}`}>Servicio {indice + 1}</label>
                  <input
                    id={`servicio-nombre-${indice}`}
                    type="text"
                    value={servicio.name}
                    onChange={(evento) => manejarCambioServicio(indice, "name", evento.target.value)}
                    placeholder="Consulta general"
                  />
                </div>

                <div className="campo campo-corto">
                  <label htmlFor={`servicio-precio-${indice}`}>Precio</label>
                  <input
                    id={`servicio-precio-${indice}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={servicio.price}
                    onChange={(evento) => manejarCambioServicio(indice, "price", evento.target.value)}
                    placeholder="60000"
                  />
                </div>

                <div className="campo campo-corto">
                  <label htmlFor={`servicio-duracion-${indice}`}>Duración</label>
                  <select
                    id={`servicio-duracion-${indice}`}
                    value={servicio.durationMinutes}
                    onChange={(evento) =>
                      manejarCambioServicio(indice, "durationMinutes", evento.target.value)
                    }
                  >
                    {DURACIONES.map((minutos) => (
                      <option key={minutos} value={minutos}>
                        {minutos} min
                      </option>
                    ))}
                  </select>
                </div>

                {servicios.length > 1 && (
                  <button
                    type="button"
                    className="boton-enlace"
                    onClick={() => quitarServicio(indice)}
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}

            {servicios.length < MAXIMO_SERVICIOS && (
              <button type="button" className="boton boton-secundario" onClick={agregarServicio}>
                + Agregar otro servicio
              </button>
            )}

            <p className="ayuda ayuda-bloque">
              Tu horario inicial será de lunes a viernes, de 9:00 a 13:00 y de 14:00 a 18:00.
            </p>
          </>
        )}

        <button type="submit" className="boton boton-primario boton-enviar" disabled={enviando}>
          {enviando ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>

      <p className="auth-pie">
        ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
      </p>
    </AuthLayout>
  );
}

export default Register;
