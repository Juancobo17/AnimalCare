// Controlador de autenticacion.
// Valida la entrada, decide el codigo HTTP y arma el mensaje de respuesta.
//
// Cubre las historias AN-6 (registro de cliente), AN-7 (registro de veterinario)
// y AN-8 (inicio de sesion).
const authService = require("../services/auth.service");
const {
  MIN_DURATION_MINUTES: MIN_SERVICE_DURATION,
  MAX_DURATION_MINUTES: MAX_SERVICE_DURATION,
} = require("../utils/schedule");

const MIN_PASSWORD_LENGTH = 6;
const MENSAJE_CONTRASENA =
  "La contraseña debe tener mínimo 6 caracteres y contener al menos un número";
const MAX_PHOTO_URL_LENGTH = 500;
const MAX_NAME_LENGTH = 60;
const MAX_LICENSE_LENGTH = 10;
const MIN_LICENSE_LENGTH = 4;
const MAX_SPECIALTY_LENGTH = 60;
const MIN_SPECIALTY_LENGTH = 3;
const MAX_BIO_LENGTH = 500;
const MAX_ADDRESS_LENGTH = 150;
const MAX_SERVICES = 10;
const MAX_SERVICE_NAME_LENGTH = 60;
const MAX_SERVICE_PRICE = 999999.99;

const ROLES_VALIDOS = ["CLIENT", "VETERINARIAN"];

// Validacion sencilla de formato de correo.
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Normaliza un texto opcional: "" y ausente se guardan como null.
function optionalText(value) {
  const text = value === undefined || value === null ? "" : String(value).trim();
  return text === "" ? null : text;
}

// Interpreta un valor que llega del formulario como booleano.
// Acepta true, "true" y "on" (lo que envian los checkbox).
function toBoolean(value) {
  return value === true || value === "true" || value === "on";
}

// Valida los servicios que el veterinario carga al registrarse.
// Devuelve los servicios ya normalizados y los errores encontrados.
function validateServices(services) {
  const errors = [];
  const values = [];

  if (services === undefined || services === null) {
    return { errors, values };
  }

  if (!Array.isArray(services)) {
    errors.push("Los servicios deben enviarse como una lista.");
    return { errors, values };
  }

  if (services.length > MAX_SERVICES) {
    errors.push(`No puedes registrar mas de ${MAX_SERVICES} servicios.`);
    return { errors, values };
  }

  services.forEach((service, index) => {
    const posicion = index + 1;
    const nombre = String(service?.name ?? "").trim();
    const precioTexto = String(service?.price ?? "").trim();
    const duracionTexto = String(service?.durationMinutes ?? "30").trim();

    // Una fila completamente vacia se descarta: el formulario puede tener
    // filas de mas que el usuario no llego a llenar.
    if (nombre === "" && precioTexto === "") {
      return;
    }

    let valido = true;

    if (nombre === "") {
      errors.push(`El servicio ${posicion} necesita un nombre.`);
      valido = false;
    } else if (nombre.length > MAX_SERVICE_NAME_LENGTH) {
      errors.push(`El nombre del servicio ${posicion} no puede superar los ${MAX_SERVICE_NAME_LENGTH} caracteres.`);
      valido = false;
    }

    const precio = Number(precioTexto);
    if (precioTexto === "" || !Number.isFinite(precio)) {
      errors.push(`El precio del servicio ${posicion} debe ser un numero.`);
      valido = false;
    } else if (precio <= 0) {
      errors.push(`El precio del servicio ${posicion} debe ser mayor que cero.`);
      valido = false;
    } else if (precio > MAX_SERVICE_PRICE) {
      errors.push(`El precio del servicio ${posicion} es demasiado alto.`);
      valido = false;
    }

    const duracion = Number(duracionTexto);
    if (!Number.isInteger(duracion)) {
      errors.push(`La duracion del servicio ${posicion} debe ser un numero entero de minutos.`);
      valido = false;
    } else if (duracion < MIN_SERVICE_DURATION || duracion > MAX_SERVICE_DURATION) {
      errors.push(
        `La duracion del servicio ${posicion} debe estar entre ${MIN_SERVICE_DURATION} y ${MAX_SERVICE_DURATION} minutos.`
      );
      valido = false;
    } else if (duracion % MIN_SERVICE_DURATION !== 0) {
      errors.push(`La duracion del servicio ${posicion} debe ser multiplo de ${MIN_SERVICE_DURATION} minutos.`);
      valido = false;
    }

    if (valido) {
      values.push({
        name: nombre,
        description: optionalText(service?.description),
        price: Math.round(precio * 100) / 100,
        durationMinutes: duracion,
      });
    }
  });

  return { errors, values };
}

// Valida los datos profesionales del veterinario (AN-7).
function validateVetProfile(body) {
  const errors = [];
  const values = {};

  const license = String(body.license ?? "").trim().toUpperCase();
  if (license === "") {
    errors.push("El número de matrícula es obligatorio.");
  } else if (license.length < MIN_LICENSE_LENGTH || license.length > MAX_LICENSE_LENGTH) {
    errors.push(
      `La matrícula debe tener entre ${MIN_LICENSE_LENGTH} y ${MAX_LICENSE_LENGTH} caracteres.`
    );
  } else if (!/^[A-Z0-9-]+$/.test(license)) {
    // El guion se mantiene como valido (ej. MV-8765) hasta que se confirme en la HU-002.
    errors.push("La matrícula solo puede contener letras, números y guiones.");
  } else {
    values.license = license;
  }

  const specialty = String(body.specialty ?? "").trim();
  if (specialty === "") {
    errors.push("La especialidad es obligatoria.");
  } else if (specialty.length < MIN_SPECIALTY_LENGTH || specialty.length > MAX_SPECIALTY_LENGTH) {
    errors.push(
      `La especialidad debe tener entre ${MIN_SPECIALTY_LENGTH} y ${MAX_SPECIALTY_LENGTH} caracteres.`
    );
  } else {
    values.specialty = specialty;
  }

  const photoUrl = optionalText(body.photoUrl);
  if (photoUrl && (photoUrl.length > MAX_PHOTO_URL_LENGTH || !/^https?:\/\/\S+$/i.test(photoUrl))) {
    errors.push("La foto debe ser un enlace válido que empiece por http:// o https://.");
  } else {
    values.photoUrl = photoUrl;
  }

  const bio = optionalText(body.bio);
  if (bio && bio.length > MAX_BIO_LENGTH) {
    errors.push(`La descripcion no puede superar los ${MAX_BIO_LENGTH} caracteres.`);
  } else {
    values.bio = bio;
  }

  const phone = optionalText(body.phone);
  if (phone && !/^[0-9+\s-]{7,15}$/.test(phone)) {
    errors.push("El telefono no tiene un formato valido.");
  } else {
    values.phone = phone;
  }

  // Modalidades de atencion (AN-10 y AN-11).
  const homeService = toBoolean(body.homeService);
  const clinicService = toBoolean(body.clinicService);

  if (!homeService && !clinicService) {
    errors.push("Debes ofrecer al menos una modalidad de atencion: a domicilio o en veterinaria.");
  }
  values.homeService = homeService;
  values.clinicService = clinicService;

  // La direccion solo es obligatoria si el cliente puede ir al consultorio.
  const address = optionalText(body.address);
  if (clinicService && !address) {
    errors.push("La direccion del consultorio es obligatoria si atiendes en la veterinaria.");
  } else if (address && address.length > MAX_ADDRESS_LENGTH) {
    errors.push(`La direccion no puede superar los ${MAX_ADDRESS_LENGTH} caracteres.`);
  } else {
    values.address = address;
  }

  const servicios = validateServices(body.services);
  errors.push(...servicios.errors);
  values.services = servicios.values;

  return { errors, values };
}

// Reune los errores de los datos de registro comunes a cualquier cuenta.
// Devolver una lista permite mostrar todos los problemas a la vez.
function validateRegisterData({ name, email, password }) {
  const errors = [];

  const nombre = String(name ?? "").trim();
  if (nombre === "") {
    errors.push("El nombre es obligatorio.");
  } else if (nombre.length > MAX_NAME_LENGTH) {
    errors.push(`El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres.`);
  }

  if (!email || String(email).trim() === "") {
    errors.push("El correo es obligatorio.");
  } else if (!isValidEmail(String(email).trim())) {
    errors.push("El correo no tiene un formato valido.");
  }

  if (!password || String(password).trim() === "") {
    errors.push("La contrasena es obligatoria.");
  } else if (String(password).length < MIN_PASSWORD_LENGTH || !/\d/.test(String(password))) {
    errors.push(MENSAJE_CONTRASENA);
  }

  return errors;
}

const MENSAJE_CORREO_DUPLICADO = "El correo ya está registrado.";
const MENSAJE_MATRICULA_DUPLICADA =
  "El número de matrícula ya pertenece a otro profesional.";

// Respuesta 400 para campos unicos repetidos. fieldErrors = { email?, license? }
function duplicateResponse(res, fieldErrors) {
  const errors = Object.values(fieldErrors);
  return res.status(400).json({
    message: errors[0],
    errors,
    fieldErrors,
  });
}

// POST /api/auth/register
// El campo role decide si se crea un cliente (AN-6) o un veterinario (AN-7).
async function register(req, res) {
  try {
    const { name, email, password, role } = req.body || {};

    const errors = validateRegisterData({ name, email, password });

    // Si no se envia role, la cuenta es de cliente.
    const rolSolicitado = role === undefined || role === null || String(role).trim() === ""
      ? "CLIENT"
      : String(role).trim().toUpperCase();

    if (!ROLES_VALIDOS.includes(rolSolicitado)) {
      errors.push("El tipo de cuenta no es valido.");
    }

    // Los datos profesionales solo se validan si se registra un veterinario.
    let profile = null;
    if (rolSolicitado === "VETERINARIAN") {
      const perfil = validateVetProfile(req.body || {});
      errors.push(...perfil.errors);
      profile = perfil.values;
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors,
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Los duplicados se reportan por campo (fieldErrors) para que el frontend
    // resalte el campo exacto en rojo, ademas del resumen general.
    const fieldErrors = {};

    // El correo debe ser unico.
    const existingUser = await authService.findUserByEmail(normalizedEmail);
    if (existingUser) {
      fieldErrors.email = MENSAJE_CORREO_DUPLICADO;
    }

    // La matricula identifica al profesional: tampoco puede repetirse.
    if (rolSolicitado === "VETERINARIAN") {
      const existingLicense = await authService.findVetProfileByLicense(profile.license);
      if (existingLicense) {
        fieldErrors.license = MENSAJE_MATRICULA_DUPLICADA;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return duplicateResponse(res, fieldErrors);
    }

    const user = await authService.createUser({
      name: String(name).trim(),
      email: normalizedEmail,
      password: String(password),
      role: rolSolicitado,
      profile,
    });

    const message = rolSolicitado === "VETERINARIAN"
      ? "El veterinario fue registrado correctamente."
      : "El usuario fue registrado correctamente.";

    return res.status(201).json({
      message,
      user: authService.toPublicUser(user),
    });
  } catch (error) {
    // Respaldo: si dos registros llegan casi a la vez, la base rechaza el duplicado
    // (P2002). Se traduce a un mensaje claro en vez de un error generico.
    if (error && error.code === "P2002") {
      const objetivo = String(error.meta?.target ?? "");
      const fieldErrors = {};
      if (objetivo.includes("license")) {
        fieldErrors.license = MENSAJE_MATRICULA_DUPLICADA;
      }
      if (objetivo.includes("email")) {
        fieldErrors.email = MENSAJE_CORREO_DUPLICADO;
      }
      if (Object.keys(fieldErrors).length > 0) {
        return duplicateResponse(res, fieldErrors);
      }
    }
    console.error("Error en register:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    const errors = [];
    if (!email || String(email).trim() === "") {
      errors.push("El correo es obligatorio.");
    }
    if (!password || String(password).trim() === "") {
      errors.push("La contrasena es obligatoria.");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Los datos enviados no son validos.",
        errors,
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await authService.findUserByEmail(normalizedEmail);

    // Se responde lo mismo si el correo no existe o si la contrasena es incorrecta,
    // para no revelar que correos estan registrados en el sistema.
    if (!user) {
      return res.status(401).json({ message: "Credenciales incorrectas." });
    }

    const passwordMatches = await authService.verifyPassword(String(password), user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Credenciales incorrectas." });
    }

    const token = authService.generateToken(user);

    return res.status(200).json({
      message: "Inicio de sesion correcto.",
      token,
      user: authService.toPublicUser(user),
    });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
  }
}

// GET /api/auth/me  (ruta privada)
// El middleware ya valido el token y coloco req.user.
function me(req, res) {
  return res.status(200).json({ user: req.user });
}

module.exports = { register, login, me };
