// Pruebas de API del Sprint 2.
//
// Recorre los criterios de aceptacion de AN-12, AN-14, AN-27, AN-28, AN-29,
// AN-30, AN-31, AN-35, AN-37 y AN-38 (y lo que el Sprint 2 cambio de AN-7 y AN-8),
// las historias relacionadas AN-15, AN-16, AN-17, AN-22 y AN-23, y las mejoras
// propuestas: mascotas, resenas, recordatorios, politica de cancelacion,
// buscador con filtros y proximo turno, dias disponibles, perfil con foto y
// tarjeta profesional, y paginacion del panel de administracion.
//
// Requisitos: el backend corriendo y la base de datos migrada.
//   npm test                         (usa http://localhost:4000/api)
//   API_URL=http://host:puerto/api npm test
//
// Crea sus propios usuarios (correos qa.sprint2.*) y los borra al terminar,
// junto con sus citas, servicios, horarios, bloqueos y notificaciones.
require("dotenv").config();

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");

const prisma = require("../src/prisma");
const uploads = require("../src/utils/uploads");
const { runReminders } = require("../src/services/reminder.service");
const { toDateString } = require("../src/utils/schedule");

const API = process.env.API_URL || `http://localhost:${process.env.PORT || 4000}/api`;
const RUN = `${Date.now()}`.slice(-7);
const PREFIJO = `qa.sprint2.${RUN}`;
const CLAVE = "clave123";

// ---------- utilidades ----------

async function http(method, path, { token, body } = {}) {
  const respuesta = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const texto = await respuesta.text();
  return { status: respuesta.status, data: texto ? JSON.parse(texto) : null };
}

async function login(email, password = CLAVE) {
  return http("POST", "/auth/login", { body: { email, password } });
}

async function tokenDe(email) {
  const r = await login(email);
  assert.equal(r.status, 200, `login de ${email}: ${JSON.stringify(r.data)}`);
  return r.data.token;
}

// Proxima fecha (AAAA-MM-DD, UTC) que cae en ese dia de la semana,
// al menos minDias dias despues de hoy.
function proximo(weekday, minDias = 2) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + minDias);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function errores(r) {
  return (r.data?.errors || [r.data?.message]).join(" | ");
}

// ---------- datos de la prueba ----------

const LUNES = proximo(1);
const MARTES = proximo(2);
const MIERCOLES = proximo(3);
const JUEVES = proximo(4);
const VIERNES = proximo(5);
const NOMBRE_VET = `Vet QA ${RUN}`;
const NOMBRE_SERVICIO = `Dermatoscopia QA ${RUN}`;

const ctx = {};

function registroVeterinario(email, license, name = NOMBRE_VET) {
  return http("POST", "/auth/register", {
    body: {
      name,
      email,
      password: CLAVE,
      acceptPrivacy: true,
      role: "VETERINARIAN",
      license,
      specialty: "Dermatología",
      clinicService: true,
      homeService: false,
      address: `Calle 5 # 10-20, Barrio QA${RUN}, Popayán`,
      phone: "3001234567",
      services: [],
    },
  });
}

before(async () => {
  // Si el cliente de Prisma no conoce las tablas del Sprint 2, la limpieza
  // final no podria borrar lo que se cree: se detiene antes de empezar.
  if (!prisma.notification || !prisma.scheduleBlock || !prisma.review || !prisma.medicalRecord) {
    throw new Error("El cliente de Prisma está desactualizado. Ejecuta `npx prisma generate` y reinicia el backend.");
  }

  ctx.emails = {
    admin: `${PREFIJO}.admin@test.com`,
    clienteA: `${PREFIJO}.a@test.com`,
    clienteB: `${PREFIJO}.b@test.com`,
    vet: `${PREFIJO}.vet@test.com`,
    vet2: `${PREFIJO}.vet2@test.com`,
  };

  // El administrador no se registra por la API: se crea igual que el script create-admin.
  await prisma.user.create({
    data: {
      name: "Admin QA",
      email: ctx.emails.admin,
      password: await bcrypt.hash(CLAVE, 10),
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  for (const clave of ["clienteA", "clienteB"]) {
    const r = await http("POST", "/auth/register", {
      body: { name: `Cliente ${clave} QA`, email: ctx.emails[clave], password: CLAVE, acceptPrivacy: true },
    });
    assert.equal(r.status, 201, errores(r));
  }

  ctx.admin = await tokenDe(ctx.emails.admin);
  ctx.clienteA = await tokenDe(ctx.emails.clienteA);
  ctx.clienteB = await tokenDe(ctx.emails.clienteB);

  // El backend tambien debe correr con el Prisma nuevo.
  const ping = await http("GET", "/notifications", { token: ctx.admin });
  if (ping.status !== 200) {
    throw new Error(
      `GET /notifications respondió ${ping.status}. Reinicia el backend después de ejecutar \`npx prisma generate\`.`
    );
  }
});

after(async () => {
  const usuarios = await prisma.user.findMany({
    // Una cuenta eliminada cambia de correo: se busca tambien por el id que creo la prueba.
    where: { OR: [{ email: { startsWith: PREFIJO } }, { id: { in: ctx.creados || [] } }] },
    include: { vetProfile: true },
  });
  const userIds = usuarios.map((u) => u.id);
  const vetIds = usuarios.filter((u) => u.vetProfile).map((u) => u.vetProfile.id);

  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.authToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.medicalRecord.deleteMany({
    where: { OR: [{ pet: { userId: { in: userIds } } }, { vetProfileId: { in: vetIds } }] },
  });
  await prisma.review.deleteMany({
    where: { OR: [{ clientId: { in: userIds } }, { vetProfileId: { in: vetIds } }] },
  });
  await prisma.appointment.deleteMany({
    where: { OR: [{ clientId: { in: userIds } }, { vetProfileId: { in: vetIds } }] },
  });
  await prisma.pet.deleteMany({ where: { userId: { in: userIds } } });
  // Archivos subidos por el veterinario de prueba.
  for (const usuario of usuarios.filter((u) => u.vetProfile)) {
    await uploads.deletePhoto(usuario.vetProfile.photoUrl);
    await uploads.deleteDoc(usuario.vetProfile.licenseDocPath);
  }
  await prisma.scheduleBlock.deleteMany({ where: { vetProfileId: { in: vetIds } } });
  await prisma.availability.deleteMany({ where: { vetProfileId: { in: vetIds } } });
  await prisma.service.deleteMany({ where: { vetProfileId: { in: vetIds } } });
  await prisma.vetProfile.deleteMany({ where: { id: { in: vetIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

// ======================================================================

describe("AN-7 / AN-8: el veterinario nuevo queda pendiente de verificacion", () => {
  test("el registro deja la cuenta PENDING con el mensaje de revision", async () => {
    const r = await registroVeterinario(ctx.emails.vet, `QA${RUN}`);
    assert.equal(r.status, 201, errores(r));
    assert.equal(r.data.user.status, "PENDING");
    assert.equal(
      r.data.message,
      "Registro exitoso. Tu perfil está en revisión para validar tu tarjeta profesional."
    );
    ctx.vetProfileId = r.data.user.vetProfile.id;
    ctx.vetUserId = r.data.user.id;
  });

  test("el veterinario pendiente puede iniciar sesion y /me informa su estado", async () => {
    ctx.vet = await tokenDe(ctx.emails.vet);
    const me = await http("GET", "/auth/me", { token: ctx.vet });
    assert.equal(me.data.user.status, "PENDING");
  });

  test("credenciales incorrectas muestran el mensaje de AN-8", async () => {
    const r = await login(ctx.emails.vet, "otraClave1");
    assert.equal(r.status, 401);
    assert.equal(r.data.message, "Correo o contraseña incorrectos. Por favor, verifica tus datos.");
  });

  test("un veterinario pendiente no aparece en el buscador ni se puede ver su perfil", async () => {
    const lista = await http("GET", `/vets?q=${encodeURIComponent(NOMBRE_VET)}`, { token: ctx.clienteA });
    assert.equal(lista.data.total, 0);
    const perfil = await http("GET", `/vets/${ctx.vetProfileId}`, { token: ctx.clienteA });
    assert.equal(perfil.status, 404);
  });
});

describe("AN-28: agregar servicios al perfil profesional", () => {
  test("con la cuenta pendiente el servicio se guarda pero queda oculto (criterio 2)", async () => {
    const r = await http("POST", "/vets/me/services", {
      token: ctx.vet,
      body: { name: NOMBRE_SERVICIO, price: "60000", durationMinutes: 30 },
    });
    assert.equal(r.status, 201, errores(r));
    assert.match(r.data.message, /cuando tu cuenta sea aprobada/);
    ctx.servicioId = r.data.service.id;

    const mios = await http("GET", "/vets/me/services", { token: ctx.vet });
    assert.equal(mios.data.visible, false);
    assert.equal(mios.data.services.length, 1);
  });

  test("con el nombre en blanco se bloquea el guardado (criterio 3)", async () => {
    const r = await http("POST", "/vets/me/services", {
      token: ctx.vet,
      body: { name: "  ", price: "50000", durationMinutes: 30 },
    });
    assert.equal(r.status, 400);
    assert.match(errores(r), /Todos los campos son obligatorios/);
  });

  test("un cliente no puede usar el panel del veterinario", async () => {
    const r = await http("GET", "/vets/me/services", { token: ctx.clienteA });
    assert.equal(r.status, 403);
  });
});

describe("AN-35 y AN-38: verificacion de veterinarios y listado de usuarios", () => {
  test("solo el administrador entra al panel de usuarios", async () => {
    assert.equal((await http("GET", "/admin/users", { token: ctx.clienteA })).status, 403);
    assert.equal((await http("GET", "/admin/users", { token: ctx.vet })).status, 403);
    assert.equal((await http("GET", "/admin/users")).status, 401);
  });

  test("el listado muestra nombre, rol, fecha de registro y estado (AN-38 criterio 1)", async () => {
    const r = await http("GET", `/admin/users?q=${PREFIJO}`, { token: ctx.admin });
    assert.equal(r.status, 200);
    assert.equal(r.data.total, 4);
    const vet = r.data.users.find((u) => u.email === ctx.emails.vet);
    assert.deepEqual(
      { role: vet.role, status: vet.status, tieneFecha: Boolean(vet.createdAt), name: vet.name },
      { role: "VETERINARIAN", status: "PENDING", tieneFecha: true, name: NOMBRE_VET }
    );
    assert.equal(vet.vetProfile.license, `QA${RUN}`);
    assert.ok(r.data.counts.PENDING >= 1);
  });

  test("el filtro de estado devuelve solo ese estado (AN-38 criterio 2)", async () => {
    const r = await http("GET", `/admin/users?status=PENDING&q=${PREFIJO}`, { token: ctx.admin });
    assert.deepEqual(r.data.users.map((u) => u.email), [ctx.emails.vet]);
  });

  test("una busqueda sin coincidencias devuelve una lista vacia (AN-38 criterio 3)", async () => {
    const r = await http("GET", "/admin/users?q=no-existe-nadie-asi-xyz", { token: ctx.admin });
    assert.equal(r.status, 200);
    assert.equal(r.data.total, 0);
  });

  test("filtros invalidos responden 400", async () => {
    const r = await http("GET", "/admin/users?status=BORRADO", { token: ctx.admin });
    assert.equal(r.status, 400);
  });

  test("aprobar o rechazar solo aplica a veterinarios", async () => {
    const lista = await http("GET", `/admin/users?q=${encodeURIComponent(ctx.emails.clienteB)}`, { token: ctx.admin });
    const r = await http("PATCH", `/admin/users/${lista.data.users[0].id}/approve`, { token: ctx.admin });
    assert.equal(r.status, 400);
  });

  test("al aprobar, el estado pasa a ACTIVE y se notifica al veterinario (criterio 2)", async () => {
    const r = await http("PATCH", `/admin/users/${ctx.vetUserId}/approve`, { token: ctx.admin });
    assert.equal(r.status, 200, errores(r));
    assert.equal(r.data.user.status, "ACTIVE");

    const avisos = await http("GET", "/notifications", { token: ctx.vet });
    assert.equal(avisos.data.unread, 1);
    assert.match(avisos.data.notifications[0].message, /aprobada/);

    const marcar = await http("PATCH", `/notifications/${avisos.data.notifications[0].id}/read`, { token: ctx.vet });
    assert.equal(marcar.status, 200);
    const otraPersona = await http("PATCH", `/notifications/${avisos.data.notifications[0].id}/read`, { token: ctx.clienteA });
    assert.equal(otraPersona.status, 404);
  });

  test("aprobar dos veces responde 409", async () => {
    const r = await http("PATCH", `/admin/users/${ctx.vetUserId}/approve`, { token: ctx.admin });
    assert.equal(r.status, 409);
  });

  test("ya aprobado, el perfil y su servicio son publicos (AN-28 criterio 1)", async () => {
    const r = await http("GET", `/vets/${ctx.vetProfileId}`, { token: ctx.clienteA });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.vet.services.map((s) => s.name), [NOMBRE_SERVICIO]);
  });

  test("al rechazar, la cuenta queda denegada y no puede iniciar sesion (criterio 3)", async () => {
    const reg = await registroVeterinario(ctx.emails.vet2, `QB${RUN}`, `Vet Rechazado ${RUN}`);
    assert.equal(reg.status, 201, errores(reg));
    ctx.vet2Id = reg.data.user.id;
    const r = await http("PATCH", `/admin/users/${reg.data.user.id}/reject`, { token: ctx.admin });
    assert.equal(r.status, 200);
    assert.equal(r.data.user.status, "REJECTED");

    const intento = await login(ctx.emails.vet2);
    assert.equal(intento.status, 403);
    assert.match(intento.data.message, /rechazada/);
  });
});

describe("AN-12: visualizar precios de veterinarios", () => {
  test("el perfil trae nombre, descripcion, matricula, correo, telefono y servicios con precio", async () => {
    const r = await http("GET", `/vets/${ctx.vetProfileId}`, { token: ctx.clienteA });
    const v = r.data.vet;
    assert.equal(v.name, NOMBRE_VET);
    assert.equal(v.license, `QA${RUN}`);
    assert.equal(v.email, ctx.emails.vet);
    assert.equal(v.phone, "3001234567");
    assert.ok("bio" in v);
    assert.equal(v.services[0].price, 60000);
  });
});

describe("AN-27: buscar veterinarios por nombre o servicio", () => {
  test("por nombre del profesional, sin distinguir mayusculas", async () => {
    const r = await http("GET", `/vets?q=${encodeURIComponent(NOMBRE_VET.toUpperCase())}`, { token: ctx.clienteA });
    assert.deepEqual(r.data.vets.map((v) => v.id), [ctx.vetProfileId]);
  });

  test("por nombre de un servicio que ofrece", async () => {
    const r = await http("GET", `/vets?q=${encodeURIComponent(NOMBRE_SERVICIO)}`, { token: ctx.clienteA });
    assert.deepEqual(r.data.vets.map((v) => v.id), [ctx.vetProfileId]);
  });

  test("combinado con la modalidad: no atiende a domicilio (criterio 2)", async () => {
    const r = await http("GET", `/vets?q=${encodeURIComponent(NOMBRE_VET)}&mode=HOME`, { token: ctx.clienteA });
    assert.equal(r.data.total, 0);
  });

  test("busqueda demasiado larga responde 400", async () => {
    const r = await http("GET", `/vets?q=${"a".repeat(61)}`, { token: ctx.clienteA });
    assert.equal(r.status, 400);
  });
});

describe("AN-30: asignar y modificar precios", () => {
  for (const precio of ["abc", "-50000", "0", "$50000", "5e4"]) {
    test(`rechaza el precio "${precio}" (criterio 3)`, async () => {
      const r = await http("PUT", `/vets/me/services/${ctx.servicioId}`, {
        token: ctx.vet,
        body: { name: NOMBRE_SERVICIO, price: precio, durationMinutes: 30 },
      });
      assert.equal(r.status, 400);
      assert.match(errores(r), /valores numéricos mayores a cero/);
    });
  }

  test("un cliente no puede editar servicios", async () => {
    const r = await http("PUT", `/vets/me/services/${ctx.servicioId}`, {
      token: ctx.clienteA,
      body: { name: "x", price: "1", durationMinutes: 30 },
    });
    assert.equal(r.status, 403);
  });

  test("modificar el precio responde 'Precio actualizado correctamente' y se ve en el perfil", async () => {
    const r = await http("PUT", `/vets/me/services/${ctx.servicioId}`, {
      token: ctx.vet,
      body: { name: NOMBRE_SERVICIO, price: "65000", durationMinutes: 30 },
    });
    assert.equal(r.status, 200, errores(r));
    assert.equal(r.data.message, "Precio actualizado correctamente");
    ctx.servicioId = r.data.service.id;

    const perfil = await http("GET", `/vets/${ctx.vetProfileId}`, { token: ctx.clienteA });
    assert.equal(perfil.data.vet.services[0].price, 65000);
  });
});

describe("AN-31: horario base y bloqueos excepcionales", () => {
  test("el veterinario tiene el horario inicial de lunes a viernes", async () => {
    const r = await http("GET", "/vets/me/availability", { token: ctx.vet });
    assert.equal(r.data.availabilities.length, 10);
  });

  test("rechaza franjas invalidas o que se cruzan", async () => {
    const casos = [
      [],
      [{ weekday: 1, startTime: "12:00", endTime: "08:00" }],
      [{ weekday: 9, startTime: "08:00", endTime: "12:00" }],
      [
        { weekday: 1, startTime: "08:00", endTime: "12:00" },
        { weekday: 1, startTime: "11:00", endTime: "14:00" },
      ],
    ];
    for (const franjas of casos) {
      const r = await http("PUT", "/vets/me/availability", { token: ctx.vet, body: { availabilities: franjas } });
      assert.equal(r.status, 400, JSON.stringify(franjas));
    }
  });

  test("un horario de 07:00 a 12:00 se aplica a todos los dias laborales (criterio 1)", async () => {
    const franjas = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "07:00", endTime: "12:00" }));
    const r = await http("PUT", "/vets/me/availability", { token: ctx.vet, body: { availabilities: franjas } });
    assert.equal(r.status, 200, errores(r));

    const slots = await http("GET", `/vets/${ctx.vetProfileId}/slots?date=${MARTES}&mode=CLINIC`, { token: ctx.clienteA });
    assert.equal(slots.data.slots[0], "07:00");
    assert.equal(slots.data.slots.at(-1), "11:30");
  });

  test("el cliente agenda el lunes a las 08:00", async () => {
    const r = await http("POST", "/appointments", {
      token: ctx.clienteA,
      body: { vetProfileId: ctx.vetProfileId, serviceId: ctx.servicioId, mode: "CLINIC", date: LUNES, time: "08:00" },
    });
    assert.equal(r.status, 201, errores(r));
    ctx.citaLunes = r.data.appointment.id;
  });

  test("validaciones del bloqueo: sin horas, fin antes que inicio, fecha pasada", async () => {
    const sinHoras = await http("POST", "/vets/me/blocks", { token: ctx.vet, body: { date: MARTES } });
    assert.equal(sinHoras.status, 400);
    const alReves = await http("POST", "/vets/me/blocks", {
      token: ctx.vet,
      body: { date: MARTES, startTime: "10:00", endTime: "09:00" },
    });
    assert.equal(alReves.status, 400);
    const pasada = await http("POST", "/vets/me/blocks", { token: ctx.vet, body: { date: "2020-01-06", allDay: true } });
    assert.equal(pasada.status, 400);
  });

  test("bloquear el martes de 07:00 a 09:00 oculta esos turnos al cliente (criterios 2 y 3)", async () => {
    const r = await http("POST", "/vets/me/blocks", {
      token: ctx.vet,
      body: { date: MARTES, startTime: "07:00", endTime: "09:00", reason: "Capacitación" },
    });
    assert.equal(r.status, 201, errores(r));
    ctx.bloqueoMartes = r.data.block.id;

    const slots = await http("GET", `/vets/${ctx.vetProfileId}/slots?date=${MARTES}&mode=CLINIC`, { token: ctx.clienteA });
    assert.equal(slots.data.slots[0], "09:00");
    assert.ok(!slots.data.slots.includes("08:30"));
  });

  test("el cliente no puede agendar dentro del bloqueo", async () => {
    const r = await http("POST", "/appointments", {
      token: ctx.clienteB,
      body: { vetProfileId: ctx.vetProfileId, mode: "CLINIC", date: MARTES, time: "07:30" },
    });
    assert.equal(r.status, 409);
  });

  test("si hay citas en el rango, avisa y pide confirmacion (criterio 4)", async () => {
    const r = await http("POST", "/vets/me/blocks", {
      token: ctx.vet,
      body: { date: LUNES, startTime: "07:00", endTime: "09:00" },
    });
    assert.equal(r.status, 409);
    assert.equal(r.data.code, "BLOCK_CONFLICT");
    assert.deepEqual(r.data.conflicts.map((c) => c.id), [ctx.citaLunes]);

    // Abortar: la cita sigue activa y no se creo el bloqueo.
    const citas = await http("GET", "/appointments", { token: ctx.clienteA });
    assert.equal(citas.data.appointments.find((c) => c.id === ctx.citaLunes).status, "PENDING");
  });

  test("al confirmar, bloquea, cancela la cita y avisa al cliente (criterio 4)", async () => {
    const r = await http("POST", "/vets/me/blocks", {
      token: ctx.vet,
      body: { date: LUNES, startTime: "07:00", endTime: "09:00", confirm: true },
    });
    assert.equal(r.status, 201, errores(r));
    assert.equal(r.data.cancelledAppointments, 1);

    const citas = await http("GET", "/appointments", { token: ctx.clienteA });
    assert.equal(citas.data.appointments.find((c) => c.id === ctx.citaLunes).status, "CANCELLED");

    const avisos = await http("GET", "/notifications", { token: ctx.clienteA });
    assert.match(avisos.data.notifications[0].message, /fue cancelada porque el veterinario no estará disponible/);
  });

  test("el listado muestra los bloqueos y quitar uno libera los turnos", async () => {
    const lista = await http("GET", "/vets/me/blocks", { token: ctx.vet });
    assert.equal(lista.data.blocks.length, 2);

    const ajeno = await http("DELETE", `/vets/me/blocks/${ctx.bloqueoMartes}`, { token: ctx.clienteA });
    assert.equal(ajeno.status, 403);

    const r = await http("DELETE", `/vets/me/blocks/${ctx.bloqueoMartes}`, { token: ctx.vet });
    assert.equal(r.status, 200);
    const slots = await http("GET", `/vets/${ctx.vetProfileId}/slots?date=${MARTES}&mode=CLINIC`, { token: ctx.clienteA });
    assert.equal(slots.data.slots[0], "07:00");
  });

  test("un bloqueo de dia completo deja el dia sin turnos", async () => {
    const r = await http("POST", "/vets/me/blocks", { token: ctx.vet, body: { date: MARTES, allDay: true } });
    assert.equal(r.status, 201, errores(r));
    assert.equal(r.data.block.allDay, true);
    const slots = await http("GET", `/vets/${ctx.vetProfileId}/slots?date=${MARTES}&mode=CLINIC`, { token: ctx.clienteA });
    assert.equal(slots.data.slots.length, 0);
    await http("DELETE", `/vets/me/blocks/${r.data.block.id}`, { token: ctx.vet });
  });
});

describe("AN-30 y AN-29: el historial de citas no cambia", () => {
  test("cambiar el precio de un servicio ya agendado no altera la cita anterior", async () => {
    const cita = await http("POST", "/appointments", {
      token: ctx.clienteA,
      body: { vetProfileId: ctx.vetProfileId, serviceId: ctx.servicioId, mode: "CLINIC", date: MIERCOLES, time: "09:00" },
    });
    assert.equal(cita.status, 201, errores(cita));
    ctx.citaMiercoles = cita.data.appointment.id;

    const r = await http("PUT", `/vets/me/services/${ctx.servicioId}`, {
      token: ctx.vet,
      body: { name: NOMBRE_SERVICIO, price: "70000", durationMinutes: 30 },
    });
    assert.equal(r.status, 200);
    assert.notEqual(r.data.service.id, ctx.servicioId, "se crea una version nueva del servicio");
    ctx.servicioAnterior = ctx.servicioId;
    ctx.servicioId = r.data.service.id;

    const citas = await http("GET", "/appointments", { token: ctx.clienteA });
    assert.equal(citas.data.appointments.find((c) => c.id === ctx.citaMiercoles).service.price, 65000);

    const perfil = await http("GET", `/vets/${ctx.vetProfileId}`, { token: ctx.clienteA });
    assert.deepEqual(perfil.data.vet.services.map((s) => s.price), [70000]);
  });

  test("eliminar un servicio lo quita del perfil y ya no se puede agendar (AN-29 criterio 1)", async () => {
    const r = await http("DELETE", `/vets/me/services/${ctx.servicioId}`, { token: ctx.vet });
    assert.equal(r.status, 200, errores(r));

    const perfil = await http("GET", `/vets/${ctx.vetProfileId}`, { token: ctx.clienteA });
    assert.equal(perfil.data.vet.services.length, 0);

    const agendar = await http("POST", "/appointments", {
      token: ctx.clienteB,
      body: { vetProfileId: ctx.vetProfileId, serviceId: ctx.servicioId, mode: "CLINIC", date: MIERCOLES, time: "10:00" },
    });
    assert.ok([400, 404].includes(agendar.status), `status ${agendar.status}`);

    const otraVez = await http("DELETE", `/vets/me/services/${ctx.servicioId}`, { token: ctx.vet });
    assert.equal(otraVez.status, 404);
  });

  test("las citas agendadas con el servicio eliminado conservan su detalle (AN-29 criterio 2)", async () => {
    const citas = await http("GET", "/appointments", { token: ctx.clienteA });
    const cita = citas.data.appointments.find((c) => c.id === ctx.citaMiercoles);
    assert.equal(cita.service.name, NOMBRE_SERVICIO);
    assert.equal(cita.status, "PENDING");
  });
});

describe("AN-14: cancelar cita por usuario", () => {
  test("otro cliente no puede cancelarla", async () => {
    const r = await http("PATCH", `/appointments/${ctx.citaMiercoles}/cancel`, { token: ctx.clienteB });
    assert.equal(r.status, 404);
  });

  test("un administrador no cancela citas", async () => {
    const r = await http("PATCH", `/appointments/${ctx.citaMiercoles}/cancel`, { token: ctx.admin });
    assert.equal(r.status, 403);
  });

  test("el dueño la cancela, se libera el horario y se avisa al veterinario", async () => {
    const r = await http("PATCH", `/appointments/${ctx.citaMiercoles}/cancel`, { token: ctx.clienteA });
    assert.equal(r.status, 200, errores(r));
    assert.equal(r.data.appointment.status, "CANCELLED");

    const slots = await http("GET", `/vets/${ctx.vetProfileId}/slots?date=${MIERCOLES}&mode=CLINIC`, { token: ctx.clienteA });
    assert.ok(slots.data.slots.includes("09:00"));

    const avisos = await http("GET", "/notifications", { token: ctx.vet });
    assert.match(avisos.data.notifications[0].message, /canceló su cita/);
  });

  test("cancelarla de nuevo responde 409", async () => {
    const r = await http("PATCH", `/appointments/${ctx.citaMiercoles}/cancel`, { token: ctx.clienteA });
    assert.equal(r.status, 409);
  });
});

describe("AN-17: el veterinario ve las citas de un dia especifico", () => {
  test("al agendar, el veterinario recibe una notificacion de nueva cita", async () => {
    const b = await http("POST", "/appointments", {
      token: ctx.clienteB,
      body: { vetProfileId: ctx.vetProfileId, mode: "CLINIC", date: JUEVES, time: "08:00", notes: "Control" },
    });
    assert.equal(b.status, 201, errores(b));
    ctx.citaB = b.data.appointment.id;

    const a = await http("POST", "/appointments", {
      token: ctx.clienteA,
      body: { vetProfileId: ctx.vetProfileId, mode: "CLINIC", date: JUEVES, time: "10:00" },
    });
    assert.equal(a.status, 201, errores(a));
    ctx.citaA = a.data.appointment.id;

    const avisos = await http("GET", "/notifications", { token: ctx.vet });
    assert.match(avisos.data.notifications[0].message, /^Nueva cita: Cliente clienteA QA agendó/);
  });

  test("filtra la agenda por dia, ordenada por hora", async () => {
    const r = await http("GET", `/appointments?date=${JUEVES}`, { token: ctx.vet });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.appointments.map((c) => c.time), ["08:00", "10:00"]);

    const otroDia = await http("GET", `/appointments?date=${VIERNES}`, { token: ctx.vet });
    assert.equal(otroDia.data.total, 0);
  });

  test("filtra por estado pendiente", async () => {
    const r = await http("GET", `/appointments?date=${JUEVES}&status=pending`, { token: ctx.vet });
    assert.equal(r.data.total, 2);
  });

  test("cada veterinario o cliente solo ve sus propias citas del dia", async () => {
    const r = await http("GET", `/appointments?date=${JUEVES}`, { token: ctx.clienteA });
    assert.deepEqual(r.data.appointments.map((c) => c.id), [ctx.citaA]);
  });

  test("fecha o estado invalidos responden 400", async () => {
    assert.equal((await http("GET", "/appointments?date=2026-13-40", { token: ctx.vet })).status, 400);
    assert.equal((await http("GET", "/appointments?status=BORRADA", { token: ctx.vet })).status, 400);
  });
});

describe("AN-16: el veterinario modifica las citas de su agenda", () => {
  test("confirma una cita pendiente y avisa al cliente", async () => {
    const r = await http("PATCH", `/appointments/${ctx.citaB}/confirm`, { token: ctx.vet });
    assert.equal(r.status, 200, errores(r));
    assert.equal(r.data.appointment.status, "CONFIRMED");

    const avisos = await http("GET", "/notifications", { token: ctx.clienteB });
    assert.match(avisos.data.notifications[0].message, /confirmó tu cita/);

    assert.equal((await http("PATCH", `/appointments/${ctx.citaB}/confirm`, { token: ctx.vet })).status, 409);
  });

  test("el cliente no puede confirmar, reprogramar ni completar", async () => {
    for (const accion of ["confirm", "reschedule", "complete"]) {
      const r = await http("PATCH", `/appointments/${ctx.citaA}/${accion}`, {
        token: ctx.clienteA,
        body: { date: VIERNES, time: "09:00" },
      });
      assert.equal(r.status, 403, accion);
    }
  });

  test("no puede marcar como atendida una cita futura", async () => {
    const r = await http("PATCH", `/appointments/${ctx.citaB}/complete`, { token: ctx.vet });
    assert.equal(r.status, 409);
  });

  test("validaciones al reprogramar", async () => {
    const casos = [
      [{ date: JUEVES, time: "10:00" }, 409, "ocupado por otra cita"],
      [{ date: JUEVES, time: "15:00" }, 400, "fuera del horario"],
      [{ date: JUEVES, time: "08:00" }, 400, "mismo horario"],
      [{ date: "2020-01-02", time: "08:00" }, 400, "fecha pasada"],
      [{ date: JUEVES }, 400, "sin hora"],
    ];
    for (const [body, esperado, caso] of casos) {
      const r = await http("PATCH", `/appointments/${ctx.citaB}/reschedule`, { token: ctx.vet, body });
      assert.equal(r.status, esperado, `${caso}: ${errores(r)}`);
    }
  });

  test("no puede mover la cita a un horario bloqueado", async () => {
    const bloqueo = await http("POST", "/vets/me/blocks", {
      token: ctx.vet,
      body: { date: VIERNES, startTime: "11:00", endTime: "12:00" },
    });
    assert.equal(bloqueo.status, 201, errores(bloqueo));
    const r = await http("PATCH", `/appointments/${ctx.citaB}/reschedule`, {
      token: ctx.vet,
      body: { date: VIERNES, time: "11:00" },
    });
    assert.equal(r.status, 409);
    await http("DELETE", `/vets/me/blocks/${bloqueo.data.block.id}`, { token: ctx.vet });
  });

  test("reprograma a otro horario libre, libera el anterior y avisa al cliente", async () => {
    const r = await http("PATCH", `/appointments/${ctx.citaB}/reschedule`, {
      token: ctx.vet,
      body: { date: VIERNES, time: "09:00", reason: "Tengo una cirugía" },
    });
    assert.equal(r.status, 200, errores(r));
    assert.deepEqual([r.data.appointment.date, r.data.appointment.time], [VIERNES, "09:00"]);
    assert.equal(r.data.appointment.status, "CONFIRMED");

    const jueves = await http("GET", `/vets/${ctx.vetProfileId}/slots?date=${JUEVES}&mode=CLINIC`, { token: ctx.clienteA });
    assert.ok(jueves.data.slots.includes("08:00"));
    const viernes = await http("GET", `/vets/${ctx.vetProfileId}/slots?date=${VIERNES}&mode=CLINIC`, { token: ctx.clienteA });
    assert.ok(!viernes.data.slots.includes("09:00"));

    const avisos = await http("GET", "/notifications", { token: ctx.clienteB });
    assert.match(avisos.data.notifications[0].message, /cambió tu cita .* para el .* Motivo: Tengo una cirugía/);
  });

  test("marca como atendida una cita cuya hora ya llegó", async () => {
    const cita = await http("POST", "/appointments", {
      token: ctx.clienteB,
      body: { vetProfileId: ctx.vetProfileId, mode: "CLINIC", date: VIERNES, time: "10:00" },
    });
    assert.equal(cita.status, 201, errores(cita));
    // Se simula que la hora ya paso.
    await prisma.appointment.update({
      where: { id: cita.data.appointment.id },
      data: { scheduledAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const r = await http("PATCH", `/appointments/${cita.data.appointment.id}/complete`, { token: ctx.vet });
    assert.equal(r.status, 200, errores(r));
    assert.equal(r.data.appointment.status, "COMPLETED");

    const reprogramar = await http("PATCH", `/appointments/${cita.data.appointment.id}/reschedule`, {
      token: ctx.vet,
      body: { date: VIERNES, time: "11:00" },
    });
    assert.equal(reprogramar.status, 409);
  });
});

describe("AN-15: el veterinario cancela citas de su agenda", () => {
  test("un motivo de mas de 200 caracteres responde 400", async () => {
    const r = await http("PATCH", `/appointments/${ctx.citaA}/cancel`, {
      token: ctx.vet,
      body: { reason: "x".repeat(201) },
    });
    assert.equal(r.status, 400);
  });

  test("cancela con motivo, libera el horario y avisa al cliente", async () => {
    const r = await http("PATCH", `/appointments/${ctx.citaA}/cancel`, {
      token: ctx.vet,
      body: { reason: "Emergencia en la clínica" },
    });
    assert.equal(r.status, 200, errores(r));
    assert.equal(r.data.appointment.status, "CANCELLED");
    assert.equal(r.data.message, "La cita fue cancelada y se avisó al cliente.");

    const slots = await http("GET", `/vets/${ctx.vetProfileId}/slots?date=${JUEVES}&mode=CLINIC`, { token: ctx.clienteB });
    assert.ok(slots.data.slots.includes("10:00"));

    const avisos = await http("GET", "/notifications", { token: ctx.clienteA });
    assert.match(avisos.data.notifications[0].message, /canceló tu cita .* Motivo: Emergencia en la clínica/);
  });
});

describe("AN-22 y AN-23: visualizar notificaciones", () => {
  test("el cliente ve sus avisos, del mas reciente al mas antiguo, con el contador de sin leer", async () => {
    const r = await http("GET", "/notifications", { token: ctx.clienteA });
    assert.equal(r.status, 200);
    assert.ok(r.data.unread >= 2);
    const fechas = r.data.notifications.map((n) => new Date(n.createdAt).getTime());
    assert.deepEqual(fechas, [...fechas].sort((x, y) => y - x));
  });

  test("el veterinario ve los avisos de nuevas citas y cancelaciones", async () => {
    const r = await http("GET", "/notifications", { token: ctx.vet });
    const textos = r.data.notifications.map((n) => n.message).join("\n");
    assert.match(textos, /Nueva cita/);
    assert.match(textos, /canceló su cita/);
  });

  test("marcar todas como leidas deja el contador en cero solo para ese usuario", async () => {
    const antesB = (await http("GET", "/notifications", { token: ctx.clienteB })).data.unread;
    const r = await http("PATCH", "/notifications/read-all", { token: ctx.clienteA });
    assert.equal(r.status, 200);
    assert.equal((await http("GET", "/notifications", { token: ctx.clienteA })).data.unread, 0);
    assert.equal((await http("GET", "/notifications", { token: ctx.clienteB })).data.unread, antesB);
  });

  test("sin sesion responde 401", async () => {
    assert.equal((await http("GET", "/notifications")).status, 401);
  });
});

// ======================= Mejoras propuestas =======================

const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const PDF_MINIMO = `data:application/pdf;base64,${Buffer.from("%PDF-1.4\n%prueba\n%%EOF").toString("base64")}`;

describe("Mejora: mascotas del dueño", () => {
  test("registra una mascota", async () => {
    const r = await http("POST", "/pets", {
      token: ctx.clienteA,
      body: { name: "Michi", species: "Gato", sex: "Hembra", birthDate: "2022-03-10", weight: "4.2" },
    });
    assert.equal(r.status, 201, errores(r));
    assert.deepEqual(
      { name: r.data.pet.name, weight: r.data.pet.weight, birthDate: r.data.pet.birthDate },
      { name: "Michi", weight: 4.2, birthDate: "2022-03-10" }
    );
    ctx.mascota = r.data.pet.id;
  });

  test("valida nombre, especie, sexo, fecha y peso", async () => {
    const r = await http("POST", "/pets", {
      token: ctx.clienteA,
      body: { name: "", species: "Dragón", sex: "X", birthDate: "2099-01-01", weight: "-3" },
    });
    assert.equal(r.status, 400);
    assert.equal(r.data.errors.length, 5);
  });

  test("lista solo las mascotas propias y activas", async () => {
    const propias = await http("GET", "/pets", { token: ctx.clienteA });
    assert.deepEqual(propias.data.pets.map((p) => p.name), ["Michi"]);
    const ajenas = await http("GET", "/pets", { token: ctx.clienteB });
    assert.equal(ajenas.data.pets.length, 0);
  });

  test("actualiza los datos y otro cliente no puede tocarla", async () => {
    const r = await http("PUT", `/pets/${ctx.mascota}`, {
      token: ctx.clienteA,
      body: { name: "Michi", species: "Gato", sex: "Hembra", birthDate: "2022-03-10", weight: "4.5" },
    });
    assert.equal(r.status, 200, errores(r));
    assert.equal(r.data.pet.weight, 4.5);
    const ajeno = await http("PUT", `/pets/${ctx.mascota}`, {
      token: ctx.clienteB,
      body: { name: "X", species: "Gato", sex: "Macho", birthDate: "2022-03-10" },
    });
    assert.equal(ajeno.status, 404);
  });

  test("un veterinario no gestiona mascotas", async () => {
    assert.equal((await http("GET", "/pets", { token: ctx.vet })).status, 403);
  });

  test("se agenda una cita con la mascota y el veterinario la ve en su agenda", async () => {
    const r = await http("POST", "/appointments", {
      token: ctx.clienteA,
      body: { vetProfileId: ctx.vetProfileId, petId: ctx.mascota, mode: "CLINIC", date: JUEVES, time: "11:00" },
    });
    assert.equal(r.status, 201, errores(r));
    assert.deepEqual(r.data.appointment.pet, { id: ctx.mascota, name: "Michi", species: "Gato" });
    ctx.citaConMascota = r.data.appointment.id;

    const agenda = await http("GET", `/appointments?date=${JUEVES}`, { token: ctx.vet });
    assert.equal(agenda.data.appointments.find((c) => c.id === ctx.citaConMascota).pet.name, "Michi");

    const avisos = await http("GET", "/notifications", { token: ctx.vet });
    assert.match(avisos.data.notifications[0].message, /para Michi \(Gato\)/);
  });

  test("no se puede agendar con la mascota de otro cliente", async () => {
    const r = await http("POST", "/appointments", {
      token: ctx.clienteB,
      body: { vetProfileId: ctx.vetProfileId, petId: ctx.mascota, mode: "CLINIC", date: JUEVES, time: "09:00" },
    });
    assert.equal(r.status, 404);
  });
});

describe("Mejora: politica de cancelacion", () => {
  test("el cliente no puede cancelar a menos de 2 horas, el veterinario si", async () => {
    await prisma.appointment.update({
      where: { id: ctx.citaConMascota },
      data: { scheduledAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const cliente = await http("PATCH", `/appointments/${ctx.citaConMascota}/cancel`, { token: ctx.clienteA });
    assert.equal(cliente.status, 409);
    assert.match(cliente.data.message, /hasta 2 horas antes/);
  });
});

describe("Mejora: recordatorios de 24 horas", () => {
  test("avisa al cliente y al veterinario una sola vez", async () => {
    const soloPrueba = { vetProfileId: ctx.vetProfileId };
    const primera = await runReminders(new Date(), soloPrueba);
    assert.ok(primera >= 1, "debe recordar la cita que empieza en una hora");

    const avisosCliente = await http("GET", "/notifications", { token: ctx.clienteA });
    assert.match(avisosCliente.data.notifications[0].message, /^Recordatorio: tienes cita con Michi/);
    const avisosVet = await http("GET", "/notifications", { token: ctx.vet });
    assert.match(avisosVet.data.notifications[0].message, /^Recordatorio: cita con Cliente clienteA QA con Michi/);

    assert.equal(await runReminders(new Date(), soloPrueba), 0);
  });

  test("el veterinario si puede cancelar aunque falte poco", async () => {
    const r = await http("PATCH", `/appointments/${ctx.citaConMascota}/cancel`, { token: ctx.vet });
    assert.equal(r.status, 200, errores(r));
  });
});

describe("Mejora: resenas despues de una cita atendida", () => {
  test("no se puede calificar una cita que no fue atendida", async () => {
    const cita = await http("POST", "/appointments", {
      token: ctx.clienteA,
      body: { vetProfileId: ctx.vetProfileId, petId: ctx.mascota, mode: "CLINIC", date: JUEVES, time: "11:00" },
    });
    assert.equal(cita.status, 201, errores(cita));
    ctx.citaResena = cita.data.appointment.id;
    const r = await http("POST", `/appointments/${ctx.citaResena}/review`, {
      token: ctx.clienteA,
      body: { rating: 5 },
    });
    assert.equal(r.status, 409);
  });

  test("despues de atendida, el cliente la califica y se actualiza el promedio", async () => {
    await prisma.appointment.update({
      where: { id: ctx.citaResena },
      data: { scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    });
    assert.equal((await http("PATCH", `/appointments/${ctx.citaResena}/complete`, { token: ctx.vet })).status, 200);

    const invalida = await http("POST", `/appointments/${ctx.citaResena}/review`, {
      token: ctx.clienteA,
      body: { rating: 6 },
    });
    assert.equal(invalida.status, 400);
    const ajena = await http("POST", `/appointments/${ctx.citaResena}/review`, {
      token: ctx.clienteB,
      body: { rating: 1 },
    });
    assert.equal(ajena.status, 404);

    const r = await http("POST", `/appointments/${ctx.citaResena}/review`, {
      token: ctx.clienteA,
      body: { rating: 4, comment: "Muy amable con Michi" },
    });
    assert.equal(r.status, 201, errores(r));
    assert.deepEqual(r.data.appointment.review, { rating: 4, comment: "Muy amable con Michi" });

    const perfil = await http("GET", `/vets/${ctx.vetProfileId}`, { token: ctx.clienteB });
    assert.equal(perfil.data.vet.rating, 4);
    assert.equal(perfil.data.vet.reviewsCount, 1);
    assert.deepEqual(
      { rating: perfil.data.vet.reviews[0].rating, author: perfil.data.vet.reviews[0].author },
      { rating: 4, author: "Cliente" }
    );
  });

  test("solo se califica una vez y el veterinario no puede calificar", async () => {
    const otra = await http("POST", `/appointments/${ctx.citaResena}/review`, {
      token: ctx.clienteA,
      body: { rating: 1 },
    });
    assert.equal(otra.status, 409);
    const vet = await http("POST", `/appointments/${ctx.citaResena}/review`, { token: ctx.vet, body: { rating: 5 } });
    assert.equal(vet.status, 403);
  });
});

// ======================= Sprint 3: historias clinicas =======================

describe("AN-18: crear historia clinica", () => {
  test("un veterinario sin citas con la mascota no puede verla ni escribir en ella", async () => {
    const rocky = await http("POST", "/pets", {
      token: ctx.clienteA,
      body: { name: "Rocky", species: "Perro", sex: "Macho", birthDate: "2020-01-15" },
    });
    assert.equal(rocky.status, 201, errores(rocky));
    ctx.rocky = rocky.data.pet.id;

    assert.equal((await http("GET", `/medical-records/pets/${ctx.rocky}`, { token: ctx.vet })).status, 404);
    const r = await http("POST", "/medical-records", {
      token: ctx.vet,
      body: { petId: ctx.rocky, reason: "Control", diagnosis: "Sano" },
    });
    assert.equal(r.status, 404);
  });

  test("valida los campos obligatorios y los rangos", async () => {
    const vacio = await http("POST", "/medical-records", { token: ctx.vet, body: { petId: ctx.mascota } });
    assert.equal(vacio.status, 400);
    assert.equal(vacio.data.errors.length, 2);
    const fiebre = await http("POST", "/medical-records", {
      token: ctx.vet,
      body: { petId: ctx.mascota, reason: "Fiebre", diagnosis: "x", temperature: "50" },
    });
    assert.equal(fiebre.status, 400);
    const futura = await http("POST", "/medical-records", {
      token: ctx.vet,
      body: { petId: ctx.mascota, reason: "x", diagnosis: "x", visitDate: "2099-01-01" },
    });
    assert.equal(futura.status, 400);
  });

  test("el veterinario registra la consulta de una cita atendida y se avisa al dueño", async () => {
    const r = await http("POST", "/medical-records", {
      token: ctx.vet,
      body: {
        petId: ctx.mascota,
        appointmentId: ctx.citaResena,
        reason: "Vómito ocasional",
        diagnosis: "Gastritis leve",
        treatment: "Dieta blanda por 3 días",
        weight: "4.8",
        temperature: "38.6",
        vaccines: "Triple felina (refuerzo)",
      },
    });
    assert.equal(r.status, 201, errores(r));
    assert.equal(r.data.record.appointmentId, ctx.citaResena);
    assert.equal(r.data.record.canEdit, true);
    ctx.entrada = r.data.record.id;

    // El peso medido pasa a ser el peso actual de la mascota.
    const mascotas = await http("GET", "/pets", { token: ctx.clienteA });
    assert.equal(mascotas.data.pets.find((p) => p.id === ctx.mascota).weight, 4.8);

    const avisos = await http("GET", "/notifications", { token: ctx.clienteA });
    assert.match(avisos.data.notifications[0].message, /agregó una entrada a la historia clínica de Michi/);

    const citas = await http("GET", "/appointments", { token: ctx.vet });
    assert.equal(citas.data.appointments.find((c) => c.id === ctx.citaResena).medicalRecordId, ctx.entrada);
  });

  test("una cita solo admite una entrada", async () => {
    const r = await http("POST", "/medical-records", {
      token: ctx.vet,
      body: { petId: ctx.mascota, appointmentId: ctx.citaResena, reason: "x", diagnosis: "x" },
    });
    assert.equal(r.status, 409);
  });

  test("tambien se puede registrar una entrada sin cita asociada", async () => {
    const r = await http("POST", "/medical-records", {
      token: ctx.vet,
      body: { petId: ctx.mascota, reason: "Llamada de seguimiento", diagnosis: "Evoluciona bien" },
    });
    assert.equal(r.status, 201, errores(r));
    ctx.entrada2 = r.data.record.id;
  });

  test("un cliente no puede escribir en la historia", async () => {
    const r = await http("POST", "/medical-records", {
      token: ctx.clienteA,
      body: { petId: ctx.mascota, reason: "x", diagnosis: "x" },
    });
    assert.equal(r.status, 403);
  });
});

describe("AN-21: el dueño accede a la historia clinica de su mascota", () => {
  test("ve las entradas de su mascota, de la mas reciente a la mas antigua", async () => {
    const r = await http("GET", `/medical-records/pets/${ctx.mascota}`, { token: ctx.clienteA });
    assert.equal(r.status, 200, errores(r));
    assert.equal(r.data.pet.name, "Michi");
    assert.equal(r.data.records.length, 2);
    const primera = r.data.records.find((e) => e.id === ctx.entrada);
    assert.equal(primera.diagnosis, "Gastritis leve");
    assert.equal(primera.vet.name, NOMBRE_VET);
    assert.ok(!("status" in primera), "el dueño no ve datos internos de auditoria");
  });

  test("otro cliente no puede ver la historia", async () => {
    assert.equal((await http("GET", `/medical-records/pets/${ctx.mascota}`, { token: ctx.clienteB })).status, 404);
  });

  test("el veterinario ve ademas sus citas pasadas sin registrar", async () => {
    const r = await http("GET", `/medical-records/pets/${ctx.mascota}`, { token: ctx.vet });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data.pendingAppointments));
    assert.ok(!r.data.pendingAppointments.some((c) => c.id === ctx.citaResena), "la cita ya registrada no aparece");
  });
});

describe("AN-20: modificar historia clinica", () => {
  test("el autor modifica su entrada", async () => {
    const r = await http("PUT", `/medical-records/${ctx.entrada}`, {
      token: ctx.vet,
      body: { reason: "Vómito ocasional", diagnosis: "Gastritis leve por cambio de alimento", treatment: "Dieta blanda" },
    });
    assert.equal(r.status, 200, errores(r));
    assert.equal(r.data.record.diagnosis, "Gastritis leve por cambio de alimento");
  });

  test("otro veterinario que atiende a la mascota ve la historia pero no puede modificarla", async () => {
    // Se habilita un segundo veterinario y la mascota tiene cita con el.
    assert.equal((await http("PATCH", `/admin/users/${ctx.vet2Id}/approve`, { token: ctx.admin })).status, 200);
    const perfil2 = await http("GET", `/vets?q=${encodeURIComponent(`Vet Rechazado ${RUN}`)}`, { token: ctx.clienteA });
    const cita = await http("POST", "/appointments", {
      token: ctx.clienteA,
      body: { vetProfileId: perfil2.data.vets[0].id, petId: ctx.mascota, mode: "CLINIC", date: JUEVES, time: "09:00" },
    });
    assert.equal(cita.status, 201, errores(cita));
    const vet2 = await tokenDe(ctx.emails.vet2);

    const historia = await http("GET", `/medical-records/pets/${ctx.mascota}`, { token: vet2 });
    assert.equal(historia.status, 200);
    assert.equal(historia.data.records.find((e) => e.id === ctx.entrada).canEdit, false);

    const r = await http("PUT", `/medical-records/${ctx.entrada}`, {
      token: vet2,
      body: { reason: "x", diagnosis: "x" },
    });
    assert.equal(r.status, 403);
  });

  test("el cliente no puede modificar entradas", async () => {
    const r = await http("PUT", `/medical-records/${ctx.entrada}`, {
      token: ctx.clienteA,
      body: { reason: "x", diagnosis: "x" },
    });
    assert.equal(r.status, 403);
  });
});

describe("AN-19: eliminar historia clinica", () => {
  test("pide un motivo para eliminar", async () => {
    const r = await http("PATCH", `/medical-records/${ctx.entrada2}/annul`, { token: ctx.vet, body: {} });
    assert.equal(r.status, 400);
  });

  test("al eliminar, el dueño deja de verla y el veterinario la ve anulada con su motivo", async () => {
    const r = await http("PATCH", `/medical-records/${ctx.entrada2}/annul`, {
      token: ctx.vet,
      body: { reason: "Registrada por error en otra mascota" },
    });
    assert.equal(r.status, 200, errores(r));
    assert.equal(r.data.record.status, "ANNULLED");

    const dueño = await http("GET", `/medical-records/pets/${ctx.mascota}`, { token: ctx.clienteA });
    assert.deepEqual(dueño.data.records.map((e) => e.id), [ctx.entrada]);

    const vet = await http("GET", `/medical-records/pets/${ctx.mascota}`, { token: ctx.vet });
    const anulada = vet.data.records.find((e) => e.id === ctx.entrada2);
    assert.deepEqual(
      { status: anulada.status, annulReason: anulada.annulReason, canEdit: anulada.canEdit },
      { status: "ANNULLED", annulReason: "Registrada por error en otra mascota", canEdit: false }
    );
  });

  test("una entrada eliminada no se puede modificar ni volver a eliminar", async () => {
    const editar = await http("PUT", `/medical-records/${ctx.entrada2}`, {
      token: ctx.vet,
      body: { reason: "x", diagnosis: "x" },
    });
    assert.equal(editar.status, 409);
    const otraVez = await http("PATCH", `/medical-records/${ctx.entrada2}/annul`, {
      token: ctx.vet,
      body: { reason: "x" },
    });
    assert.equal(otraVez.status, 409);
  });
});

describe("Mejora: buscador con filtros, orden y proximo turno", () => {
  test("cada veterinario trae su proximo turno libre", async () => {
    const servicio = await http("POST", "/vets/me/services", {
      token: ctx.vet,
      body: { name: "Consulta QA", price: "45000", durationMinutes: 30 },
    });
    assert.equal(servicio.status, 201, errores(servicio));

    const r = await http("GET", `/vets?q=${encodeURIComponent(NOMBRE_VET)}`, { token: ctx.clienteB });
    const vet = r.data.vets[0];
    assert.match(vet.nextSlot.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(vet.nextSlot.time, /^\d{2}:\d{2}$/);
    assert.equal(vet.minPrice, 45000);
  });

  test("filtra por zona del consultorio", async () => {
    const r = await http("GET", `/vets?zone=QA${RUN}`, { token: ctx.clienteB });
    assert.ok(r.data.vets.some((v) => v.id === ctx.vetProfileId));
    assert.ok(r.data.vets.every((v) => v.address.includes(`QA${RUN}`)));
    const otraZona = await http("GET", "/vets?zone=zona-que-no-existe", { token: ctx.clienteB });
    assert.equal(otraZona.data.total, 0);
  });

  test("filtra por precio maximo", async () => {
    const barato = await http("GET", `/vets?zone=QA${RUN}&maxPrice=50000`, { token: ctx.clienteB });
    assert.equal(barato.data.total, 1);
    const caro = await http("GET", `/vets?zone=QA${RUN}&maxPrice=40000`, { token: ctx.clienteB });
    assert.equal(caro.data.total, 0);
  });

  test("ordena por precio de menor a mayor", async () => {
    const r = await http("GET", "/vets?sort=price", { token: ctx.clienteB });
    const precios = r.data.vets.map((v) => (v.minPrice === null ? Infinity : v.minPrice));
    assert.deepEqual(precios, [...precios].sort((a, b) => a - b));
  });

  test("'atiende hoy' solo deja a quienes tienen turno hoy", async () => {
    const hoy = toDateString(new Date());
    const r = await http("GET", "/vets?today=true", { token: ctx.clienteB });
    assert.ok(r.data.vets.every((v) => v.nextSlot && v.nextSlot.date === hoy));
  });

  test("parametros invalidos responden 400", async () => {
    assert.equal((await http("GET", "/vets?sort=nombre", { token: ctx.clienteB })).status, 400);
    assert.equal((await http("GET", "/vets?maxPrice=-5", { token: ctx.clienteB })).status, 400);
  });
});

describe("Mejora: dias con turnos disponibles al agendar", () => {
  test("devuelve 14 dias y los fines de semana sin turnos (solo atiende de lunes a viernes)", async () => {
    const r = await http("GET", `/vets/${ctx.vetProfileId}/days?mode=CLINIC`, { token: ctx.clienteB });
    assert.equal(r.status, 200, errores(r));
    assert.equal(r.data.days.length, 14);
    for (const dia of r.data.days) {
      const semana = new Date(`${dia.date}T00:00:00Z`).getUTCDay();
      if (semana === 0 || semana === 6) assert.equal(dia.available, 0, dia.date);
    }
    assert.ok(r.data.days.some((d) => d.available > 0));
  });

  test("una modalidad que no ofrece responde 400", async () => {
    const r = await http("GET", `/vets/${ctx.vetProfileId}/days?mode=HOME`, { token: ctx.clienteB });
    assert.equal(r.status, 400);
  });
});

describe("Mejora: perfil editable, foto y tarjeta profesional", () => {
  test("el veterinario ve y edita su perfil", async () => {
    const actual = await http("GET", "/vets/me/profile", { token: ctx.vet });
    assert.equal(actual.data.profile.license, `QA${RUN}`);

    const invalido = await http("PUT", "/vets/me/profile", {
      token: ctx.vet,
      body: { specialty: "Dermatología", homeService: false, clinicService: false },
    });
    assert.equal(invalido.status, 400);

    const r = await http("PUT", "/vets/me/profile", {
      token: ctx.vet,
      body: {
        specialty: "Dermatología",
        bio: "Atiendo perros y gatos.",
        phone: "3001234567",
        address: `Calle 5 # 10-20, Barrio QA${RUN}, Popayán`,
        clinicService: true,
        homeService: true,
      },
    });
    assert.equal(r.status, 200, errores(r));
    const perfil = await http("GET", `/vets/${ctx.vetProfileId}`, { token: ctx.clienteB });
    assert.equal(perfil.data.vet.homeService, true);
    assert.equal(perfil.data.vet.bio, "Atiendo perros y gatos.");
  });

  test("sube una foto y queda publica", async () => {
    const r = await http("PUT", "/vets/me/photo", { token: ctx.vet, body: { image: PNG_1X1 } });
    assert.equal(r.status, 200, errores(r));
    assert.match(r.data.photoUrl, /^\/uploads\/photos\/vet-\d+-[0-9a-f]+\.png$/);

    const archivo = await fetch(API.replace(/\/api$/, "") + r.data.photoUrl);
    assert.equal(archivo.status, 200);
    assert.equal(archivo.headers.get("content-type"), "image/png");
  });

  test("rechaza archivos que no son imagenes aunque digan serlo", async () => {
    const falso = `data:image/png;base64,${Buffer.from("no soy una imagen").toString("base64")}`;
    assert.equal((await http("PUT", "/vets/me/photo", { token: ctx.vet, body: { image: falso } })).status, 400);
    const gif = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
    assert.equal((await http("PUT", "/vets/me/photo", { token: ctx.vet, body: { image: gif } })).status, 400);
  });

  test("la tarjeta profesional solo la descarga el administrador", async () => {
    const r = await http("PUT", "/vets/me/license-doc", { token: ctx.vet, body: { file: PDF_MINIMO } });
    assert.equal(r.status, 200, errores(r));

    const lista = await http("GET", `/admin/users?q=${encodeURIComponent(ctx.emails.vet)}`, { token: ctx.admin });
    assert.equal(lista.data.users[0].vetProfile.hasLicenseDoc, true);
    assert.ok(!("licenseDocPath" in lista.data.users[0].vetProfile), "la ruta del archivo no se expone");

    const admin = await fetch(`${API}/admin/users/${ctx.vetUserId}/license-doc`, {
      headers: { Authorization: `Bearer ${ctx.admin}` },
    });
    assert.equal(admin.status, 200);
    assert.equal(admin.headers.get("content-type"), "application/pdf");
    assert.match(Buffer.from(await admin.arrayBuffer()).toString(), /^%PDF/);

    const cliente = await fetch(`${API}/admin/users/${ctx.vetUserId}/license-doc`, {
      headers: { Authorization: `Bearer ${ctx.clienteA}` },
    });
    assert.equal(cliente.status, 403);

    const publico = await fetch(API.replace(/\/api$/, "") + "/uploads/docs/cualquiera.pdf");
    assert.equal(publico.status, 404);
  });

  test("quitar la foto vuelve a las iniciales", async () => {
    const r = await http("DELETE", "/vets/me/photo", { token: ctx.vet });
    assert.equal(r.status, 200);
    const perfil = await http("GET", "/vets/me/profile", { token: ctx.vet });
    assert.equal(perfil.data.profile.photoUrl, null);
  });
});

describe("Mejora: paginacion del panel de administracion", () => {
  test("pagina el listado y pone primero a los pendientes", async () => {
    const r = await http("GET", `/admin/users?q=${PREFIJO}&pageSize=2`, { token: ctx.admin });
    assert.equal(r.status, 200);
    assert.equal(r.data.users.length, 2);
    assert.equal(r.data.total, 5);
    assert.equal(r.data.totalPages, 3);

    const todos = await http("GET", "/admin/users?pageSize=100", { token: ctx.admin });
    const orden = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"];
    const indices = todos.data.users.map((u) => orden.indexOf(u.status));
    assert.deepEqual(indices, [...indices].sort((a, b) => a - b));
  });

  test("pagina o tamano invalidos responden 400", async () => {
    assert.equal((await http("GET", "/admin/users?page=0", { token: ctx.admin })).status, 400);
    assert.equal((await http("GET", "/admin/users?pageSize=500", { token: ctx.admin })).status, 400);
  });
});

// ======================= Cuentas y seguridad =======================

const fs = require("node:fs");

// Ultimo correo enviado a una direccion (el backend los escribe en MAIL_OUTBOX_FILE).
function ultimoCorreo(para) {
  const archivo = process.env.MAIL_OUTBOX_FILE;
  if (!archivo || !fs.existsSync(archivo)) return null;
  const lineas = fs.readFileSync(archivo, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return lineas.reverse().find((c) => c.to === para) || null;
}
function tokenDelCorreo(correo) {
  return /token=([0-9a-f]{64})/.exec(correo?.text || "")?.[1] || null;
}

describe("Cuenta: consentimiento y verificacion de correo", () => {
  test("el registro exige aceptar la politica de privacidad", async () => {
    const r = await http("POST", "/auth/register", {
      body: { name: "Sin consentimiento", email: `${PREFIJO}.sinc@test.com`, password: CLAVE },
    });
    assert.equal(r.status, 400);
    assert.match(errores(r), /política de privacidad/);
  });

  test("al registrarse se envia un correo de verificacion y el enlace confirma el correo", async (t) => {
    if (!process.env.MAIL_OUTBOX_FILE) {
      t.skip("MAIL_OUTBOX_FILE no definido: no se puede leer el correo enviado");
      return;
    }
    const correo = ultimoCorreo(ctx.emails.clienteB);
    assert.ok(correo, "deberia haber un correo de verificacion");
    const token = tokenDelCorreo(correo);
    assert.ok(token);

    const antes = await http("GET", "/auth/me", { token: ctx.clienteB });
    assert.equal(antes.data.user.emailVerified, false);

    const r = await http("POST", "/auth/verify-email", { body: { token } });
    assert.equal(r.status, 200, errores(r));
    const despues = await http("GET", "/auth/me", { token: ctx.clienteB });
    assert.equal(despues.data.user.emailVerified, true);

    // El enlace es de un solo uso.
    assert.equal((await http("POST", "/auth/verify-email", { body: { token } })).status, 400);
    assert.equal((await http("POST", "/account/resend-verification", { token: ctx.clienteB })).status, 409);
  });

  test("un enlace invalido responde 400", async () => {
    assert.equal((await http("POST", "/auth/verify-email", { body: { token: "abc" } })).status, 400);
  });
});

describe("Cuenta: recuperar contrasena", () => {
  test("responde igual exista o no el correo, y solo crea token para correos registrados", async () => {
    const antes = await prisma.authToken.count({ where: { purpose: "PASSWORD_RESET" } });
    const existe = await http("POST", "/auth/forgot-password", { body: { email: ctx.emails.clienteA } });
    const noExiste = await http("POST", "/auth/forgot-password", { body: { email: `${PREFIJO}.nadie@test.com` } });
    assert.equal(existe.status, 200);
    assert.equal(noExiste.status, 200);
    assert.equal(existe.data.message, noExiste.data.message);
    const despues = await prisma.authToken.count({ where: { purpose: "PASSWORD_RESET" } });
    assert.equal(despues - antes, 1);
  });

  test("con el enlace del correo se cambia la contrasena y el enlace deja de servir", async (t) => {
    if (!process.env.MAIL_OUTBOX_FILE) {
      t.skip("MAIL_OUTBOX_FILE no definido");
      return;
    }
    const token = tokenDelCorreo(ultimoCorreo(ctx.emails.clienteA));
    assert.ok(token, "deberia haber un correo de recuperacion");

    const debil = await http("POST", "/auth/reset-password", { body: { token, password: "abc" } });
    assert.equal(debil.status, 400);

    const r = await http("POST", "/auth/reset-password", { body: { token, password: "nueva123" } });
    assert.equal(r.status, 200, errores(r));
    assert.equal((await login(ctx.emails.clienteA, CLAVE)).status, 401);
    assert.equal((await login(ctx.emails.clienteA, "nueva123")).status, 200);
    assert.equal((await http("POST", "/auth/reset-password", { body: { token, password: "otra123" } })).status, 400);

    // Se deja como estaba para el resto de pruebas.
    ctx.clienteA = (await login(ctx.emails.clienteA, "nueva123")).data.token;
    const vuelta = await http("PUT", "/account/password", {
      token: ctx.clienteA,
      body: { currentPassword: "nueva123", newPassword: CLAVE },
    });
    assert.equal(vuelta.status, 200, errores(vuelta));
  });
});

describe("Cuenta: mi cuenta", () => {
  test("edita el nombre", async () => {
    const r = await http("PUT", "/account", { token: ctx.clienteB, body: { name: "Cliente B Renombrado" } });
    assert.equal(r.status, 200, errores(r));
    assert.equal(r.data.user.name, "Cliente B Renombrado");
    assert.equal((await http("PUT", "/account", { token: ctx.clienteB, body: { name: " " } })).status, 400);
  });

  test("cambiar la contrasena exige la actual y una nueva valida", async () => {
    const mal = await http("PUT", "/account/password", {
      token: ctx.clienteB,
      body: { currentPassword: "incorrecta9", newPassword: "nueva123" },
    });
    assert.equal(mal.status, 400);
    const igual = await http("PUT", "/account/password", {
      token: ctx.clienteB,
      body: { currentPassword: CLAVE, newPassword: CLAVE },
    });
    assert.equal(igual.status, 400);
  });

  test("eliminar la cuenta exige la contrasena, anonimiza y cancela citas futuras", async () => {
    const reg = await http("POST", "/auth/register", {
      body: { name: "Cliente Efimero", email: `${PREFIJO}.efimero@test.com`, password: CLAVE, acceptPrivacy: true },
    });
    assert.equal(reg.status, 201, errores(reg));
    ctx.creados = [...(ctx.creados || []), reg.data.user.id];
    const token = await tokenDe(`${PREFIJO}.efimero@test.com`);
    const cita = await http("POST", "/appointments", {
      token,
      body: { vetProfileId: ctx.vetProfileId, mode: "CLINIC", date: VIERNES, time: "11:30" },
    });
    assert.equal(cita.status, 201, errores(cita));

    assert.equal((await http("DELETE", "/account", { token, body: { password: "mala123" } })).status, 400);
    const r = await http("DELETE", "/account", { token, body: { password: CLAVE } });
    assert.equal(r.status, 200, errores(r));

    assert.equal((await http("GET", "/appointments", { token })).status, 403, "el token deja de servir");
    assert.equal((await login(`${PREFIJO}.efimero@test.com`)).status, 401, "el correo ya no existe");
    const usuario = await prisma.user.findUnique({ where: { id: reg.data.user.id } });
    assert.equal(usuario.status, "DELETED");
    assert.equal(usuario.name, "Usuario eliminado");
    assert.ok(!usuario.email.includes("efimero"));
    const citaDb = await prisma.appointment.findUnique({ where: { id: cita.data.appointment.id } });
    assert.equal(citaDb.status, "CANCELLED");

    const admin = await http("GET", "/admin/users?status=DELETED", { token: ctx.admin });
    assert.ok(admin.data.users.some((u) => u.id === reg.data.user.id));
    assert.equal((await http("PATCH", `/admin/users/${reg.data.user.id}/suspend`, { token: ctx.admin })).status, 409);
  });
});

describe("Seguridad: limite de intentos de inicio de sesion", () => {
  test("tras 5 intentos fallidos el sexto responde 429 aunque la clave sea correcta", async () => {
    const email = `${PREFIJO}.bloqueo@test.com`;
    const reg = await http("POST", "/auth/register", {
      body: { name: "Cliente Bloqueo", email, password: CLAVE, acceptPrivacy: true },
    });
    assert.equal(reg.status, 201, errores(reg));
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await login(email, "incorrecta1")).status, 401);
    }
    const bloqueado = await login(email, CLAVE);
    assert.equal(bloqueado.status, 429);
    assert.match(bloqueado.data.message, /Demasiados intentos/);
    // Otro usuario no se ve afectado.
    assert.equal((await login(ctx.emails.clienteB)).status, 200);
  });

  test("las respuestas llevan cabeceras de seguridad", async () => {
    const r = await fetch(`${API}/health`);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.equal(r.headers.get("x-frame-options"), "DENY");
  });
});

describe("AN-37: suspension y bloqueo de cuentas", () => {
  test("al suspender, la sesion activa deja de servir y no puede volver a entrar", async () => {
    const lista = await http("GET", `/admin/users?q=${encodeURIComponent(ctx.emails.clienteA)}`, { token: ctx.admin });
    ctx.clienteAId = lista.data.users[0].id;

    const r = await http("PATCH", `/admin/users/${ctx.clienteAId}/suspend`, { token: ctx.admin });
    assert.equal(r.status, 200, errores(r));
    assert.equal(r.data.user.status, "SUSPENDED");

    const conTokenViejo = await http("GET", "/appointments", { token: ctx.clienteA });
    assert.equal(conTokenViejo.status, 403);
    assert.equal(conTokenViejo.data.code, "ACCOUNT_BLOCKED");

    const intento = await login(ctx.emails.clienteA);
    assert.equal(intento.status, 403);
    assert.match(intento.data.message, /suspendida/);
  });

  test("un veterinario suspendido desaparece de las busquedas", async () => {
    const r = await http("PATCH", `/admin/users/${ctx.vetUserId}/suspend`, { token: ctx.admin });
    assert.equal(r.status, 200);
    const lista = await http("GET", `/vets?q=${encodeURIComponent(NOMBRE_VET)}`, { token: ctx.clienteB });
    assert.equal(lista.data.total, 0);
  });

  test("suspender dos veces responde 409 y a un administrador 403", async () => {
    assert.equal((await http("PATCH", `/admin/users/${ctx.vetUserId}/suspend`, { token: ctx.admin })).status, 409);
    const yo = await http("GET", `/admin/users?q=${encodeURIComponent(ctx.emails.admin)}`, { token: ctx.admin });
    assert.equal((await http("PATCH", `/admin/users/${yo.data.users[0].id}/suspend`, { token: ctx.admin })).status, 403);
  });

  test("al reactivar recupera su visibilidad y sus funciones (criterio 3)", async () => {
    assert.equal((await http("PATCH", `/admin/users/${ctx.vetUserId}/reactivate`, { token: ctx.admin })).status, 200);
    const lista = await http("GET", `/vets?q=${encodeURIComponent(NOMBRE_VET)}`, { token: ctx.clienteB });
    assert.equal(lista.data.total, 1);

    assert.equal((await http("PATCH", `/admin/users/${ctx.clienteAId}/reactivate`, { token: ctx.admin })).status, 200);
    assert.equal((await login(ctx.emails.clienteA)).status, 200);
  });

  test("id inexistente responde 404", async () => {
    const r = await http("PATCH", "/admin/users/999999999/suspend", { token: ctx.admin });
    assert.equal(r.status, 404);
  });
});
