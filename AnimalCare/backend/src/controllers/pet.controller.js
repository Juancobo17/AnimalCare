// Mascotas del dueño (CLIENT).
// Registrar, listar, actualizar y desactivar. No se borran fisicamente: una
// mascota desactivada conserva sus citas anteriores.
// El dueño se toma SIEMPRE del token.
const prisma = require("../prisma");
const { parseId } = require("../utils/params");
const { parseDate } = require("../utils/schedule");

const ESPECIES = ["Perro", "Gato", "Ave", "Conejo", "Roedor", "Reptil", "Otro"];
const SEXOS = ["Macho", "Hembra"];
const MAX_NAME = 40;
const MAX_AGE_YEARS = 40;
const MAX_WEIGHT = 200;

function toPublicPet(pet) {
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    sex: pet.sex,
    birthDate: pet.birthDate.toISOString().slice(0, 10),
    weight: pet.weight === null ? null : Number(pet.weight),
  };
}

function validatePet(body = {}) {
  const errors = [];
  const nombre = String(body.name ?? "").trim();
  const especie = String(body.species ?? "").trim();
  const sexo = String(body.sex ?? "").trim();
  const fecha = parseDate(body.birthDate);
  const pesoTexto = body.weight === undefined || body.weight === null ? "" : String(body.weight).trim();

  if (nombre === "") errors.push("El nombre de la mascota es obligatorio.");
  else if (nombre.length > MAX_NAME) errors.push(`El nombre no puede superar los ${MAX_NAME} caracteres.`);

  if (!ESPECIES.includes(especie)) errors.push(`La especie debe ser una de: ${ESPECIES.join(", ")}.`);
  if (!SEXOS.includes(sexo)) errors.push("El sexo debe ser Macho o Hembra.");

  if (!body.birthDate) {
    errors.push("La fecha de nacimiento es obligatoria (puede ser aproximada).");
  } else if (!fecha) {
    errors.push("La fecha de nacimiento no es válida (formato AAAA-MM-DD).");
  } else if (fecha.getTime() > Date.now()) {
    errors.push("La fecha de nacimiento no puede estar en el futuro.");
  } else if (Date.now() - fecha.getTime() > MAX_AGE_YEARS * 365.25 * 24 * 60 * 60 * 1000) {
    errors.push(`La fecha de nacimiento no puede ser de hace más de ${MAX_AGE_YEARS} años.`);
  }

  let peso = null;
  if (pesoTexto !== "") {
    if (!/^\d+(\.\d{1,2})?$/.test(pesoTexto) || Number(pesoTexto) <= 0 || Number(pesoTexto) > MAX_WEIGHT) {
      errors.push(`El peso debe ser un número mayor a 0 y hasta ${MAX_WEIGHT} kg.`);
    } else {
      peso = Number(pesoTexto);
    }
  }

  return { errors, value: { name: nombre, species: especie, sex: sexo, birthDate: fecha, weight: peso } };
}

async function findOwnActivePet(id, userId) {
  return prisma.pet.findFirst({ where: { id, userId, status: "ACTIVE" } });
}

function serverError(res, where, error) {
  console.error(`Error en ${where}:`, error);
  return res.status(500).json({ message: "Ocurrio un error inesperado en el servidor." });
}

// GET /api/pets
async function listMyPets(req, res) {
  try {
    const pets = await prisma.pet.findMany({
      where: { userId: req.user.id, status: "ACTIVE" },
      orderBy: { name: "asc" },
    });
    return res.status(200).json({ pets: pets.map(toPublicPet), species: ESPECIES });
  } catch (error) {
    return serverError(res, "listMyPets", error);
  }
}

// POST /api/pets
async function createPet(req, res) {
  try {
    const { errors, value } = validatePet(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
    }
    const pet = await prisma.pet.create({ data: { ...value, userId: req.user.id } });
    return res.status(201).json({ message: `${pet.name} quedó registrado.`, pet: toPublicPet(pet) });
  } catch (error) {
    return serverError(res, "createPet", error);
  }
}

// PUT /api/pets/:id
async function updatePet(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "El identificador de la mascota no es valido." });
    if (!(await findOwnActivePet(id, req.user.id))) {
      return res.status(404).json({ message: "La mascota no existe." });
    }
    const { errors, value } = validatePet(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ message: "Los datos enviados no son validos.", errors });
    }
    const pet = await prisma.pet.update({ where: { id }, data: value });
    return res.status(200).json({ message: "Datos de la mascota actualizados.", pet: toPublicPet(pet) });
  } catch (error) {
    return serverError(res, "updatePet", error);
  }
}

// DELETE /api/pets/:id  (desactiva)
async function deactivatePet(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "El identificador de la mascota no es valido." });
    if (!(await findOwnActivePet(id, req.user.id))) {
      return res.status(404).json({ message: "La mascota no existe." });
    }
    await prisma.pet.update({ where: { id }, data: { status: "INACTIVE" } });
    return res.status(200).json({ message: "La mascota se quitó de tu lista. Sus citas anteriores se conservan." });
  } catch (error) {
    return serverError(res, "deactivatePet", error);
  }
}

module.exports = { listMyPets, createPet, updatePet, deactivatePet, findOwnActivePet, toPublicPet };
