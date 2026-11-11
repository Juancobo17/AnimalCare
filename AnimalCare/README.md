# AnimalCare

Proyecto universitario educativo para la materia de Aseguramiento de la Calidad del Software y Pruebas.

## Descripcion

AnimalCare es una aplicacion web que conecta a los duenos de mascotas con veterinarios. Un cliente se
registra, busca un profesional, revisa su perfil y sus servicios, elige como quiere ser atendido
(a domicilio o en la veterinaria) y agenda una cita en un horario libre. El veterinario se registra
con sus datos profesionales y consulta la agenda de las citas que le agendaron.

El proyecto se construye de forma incremental por sprints, para poder aplicar conceptos de requisitos,
historias de usuario, validaciones, pruebas funcionales y evidencias.

## Alcance del Sprint 1

| Historia | Descripcion                                         | Estado |
| -------- | --------------------------------------------------- | ------ |
| AN-6     | Registrar usuario para acceder a servicios veterinarios | Listo |
| AN-7     | Registrar veterinario para ofrecer servicios        | Listo  |
| AN-8     | Iniciar sesion                                      | Listo  |
| AN-32    | Cerrar sesion                                       | Listo  |
| AN-26    | Visualizar perfil detallado y servicios del veterinario | Listo |
| AN-10    | Seleccionar modalidad de atencion a domicilio       | Listo  |
| AN-11    | Seleccionar modalidad de atencion en veterinaria    | Listo  |
| AN-13    | Escoger fecha y hora de la cita                     | Listo  |

Reglas fundamentales:

- **Cada usuario solo ve sus propios datos.** El cliente ve las citas que agendo y el veterinario
  ve las que le agendaron. El id del usuario se toma siempre del token, nunca del body ni de la URL.
- **Solo un cliente puede agendar.** Un veterinario que intente agendar recibe 403.
- **Un veterinario solo se puede agendar en las modalidades que ofrece** y en los horarios libres
  de su agenda.

## Alcance del Sprint 2

| Historia | Descripcion                                              | Estado en el codigo |
| -------- | -------------------------------------------------------- | ------------------- |
| AN-12    | Visualizar precios de veterinarios                       | Implementada        |
| AN-27    | Buscar veterinarios por nombre o por servicio            | Implementada        |
| AN-14    | Cancelar cita por usuario                                | Implementada        |
| AN-28    | Agregar servicios al perfil profesional                  | Implementada        |
| AN-29    | Eliminar servicios del perfil                            | Implementada        |
| AN-30    | Asignar y modificar precios de los servicios             | Implementada        |
| AN-31    | Configurar horario base y bloqueos excepcionales         | Implementada        |
| AN-35    | Verificacion de cuentas de veterinarios                  | Implementada        |
| AN-37    | Suspension y bloqueo de cuentas                          | Implementada        |
| AN-38    | Visualizacion y gestion general de usuarios              | Implementada        |

Historias relacionadas que se adelantaron porque dependen de lo anterior:

| Historia | Descripcion                                              | Estado en el codigo |
| -------- | -------------------------------------------------------- | ------------------- |
| AN-15    | Cancelar citas por veterinario (con motivo opcional)     | Implementada        |
| AN-16    | Modificar citas por veterinario (reprogramar, confirmar, marcar atendida) | Implementada |
| AN-17    | Visualizar citas pendientes de un dia por veterinario    | Implementada        |
| AN-22    | Visualizar notificaciones por usuario                    | Implementada        |
| AN-23    | Visualizar notificaciones por veterinario                | Implementada (sin "emergencias": no existe esa funcion) |

AN-15, AN-16, AN-17, AN-22 y AN-23 no tienen criterios de aceptacion en Jira. Los criterios
implementados (y probados en `backend/tests/sprint2.test.js`) son:

- AN-17: la agenda se filtra por dia (`?date=`) y por estado (`?status=`), ordenada por hora.
- AN-16: reprogramar solo a un horario dentro del horario de atencion, libre y no bloqueado; no se
  puede mover a una hora pasada ni a la misma; confirmar solo citas pendientes futuras; marcar como
  atendida solo cuando la hora ya llego. El cliente recibe un aviso en cada cambio.
- AN-15: el veterinario cancela con un motivo opcional (max. 200 caracteres) que llega al cliente.
- AN-22 / AN-23: listado de avisos del mas reciente al mas antiguo, contador de sin leer en la
  cabecera, marcar uno o todos como leidos. Avisos al veterinario: nueva cita y cancelacion del
  cliente. Avisos al cliente: confirmacion, reprogramacion y cancelacion de su cita.

Decisiones del Sprint 2:

- **Solo los veterinarios `ACTIVE` son publicos.** Uno pendiente, suspendido o rechazado no aparece
  en el buscador, no muestra su perfil y no se puede agendar con el.
- **Los servicios no se borran fisicamente** (AN-29): quedan inactivos para que las citas anteriores
  conserven su detalle. Si se edita un servicio que ya se uso en citas (AN-30), se crea una version
  nueva y la anterior queda inactiva, asi el precio de las citas pasadas no cambia.
- **Un bloqueo de agenda que choca con citas** (AN-31) pide confirmacion; al confirmar, las citas
  se cancelan y cada cliente recibe una notificacion.
- **Notificaciones dentro de la plataforma**: aprobacion, rechazo, suspension y reactivacion de la
  cuenta, cancelaciones hechas por el cliente y por bloqueos de agenda. Son la base de AN-22 y AN-23.

## Alcance del Sprint 3

| Historia | Descripcion | Estado en el codigo |
| -------- | ----------- | ------------------- |
| AN-15, AN-16, AN-17 | Agenda del veterinario (cancelar, modificar, ver por dia) | Implementadas en el Sprint 2 |
| AN-22, AN-23 | Notificaciones | Implementadas en el Sprint 2 |
| AN-18 | Crear historia clinica | Implementada |
| AN-19 | Eliminar historia clinica (anula la entrada con motivo) | Implementada |
| AN-20 | Modificar historia clinica | Implementada |
| AN-21 | El dueño accede a la historia clinica de su mascota | Implementada |

Los criterios de aceptacion de estas historias, listos para copiar en Jira, estan en
[docs/criterios-aceptacion-sprint3.md](docs/criterios-aceptacion-sprint3.md).

Reglas de la historia clinica:

- Es la lista de entradas de una mascota, una por consulta (motivo, diagnostico, tratamiento, peso,
  temperatura, vacunas y observaciones).
- Un veterinario ve y escribe en la historia solo de mascotas que tienen o tuvieron una cita con el
  (no cancelada). Ve tambien las entradas de otros veterinarios, pero solo modifica o elimina las suyas.
- Eliminar no borra: anula la entrada con un motivo. El dueño deja de verla y se conserva para auditoria.
- El dueño consulta (solo lectura) la historia de sus mascotas y recibe un aviso con cada entrada nueva.

## Zona horaria

Todas las fechas y horas "de pared" (`AAAA-MM-DD`, `HH:MM`) se interpretan en la zona de la clinica,
`CLINIC_TIMEZONE` (por defecto `America/Bogota`), sin importar donde corra el servidor ni la zona del
navegador. En la base de datos se guardan instantes (UTC). Las utilidades estan en
`backend/src/utils/schedule.js` y `frontend/src/services/zona.js`, con pruebas unitarias en
`backend/tests/schedule.test.js` y `frontend/src/services/zona.test.js`.

Las bases creadas antes de este cambio guardaban la hora de pared como si fuera UTC. Para corregirlas
una sola vez: `node scripts/fix-timezone-data.js --aplicar` (sin `--aplicar` solo muestra que cambiaria).

### Mejoras de experiencia de usuario

Se agregaron tomando como referencia las plataformas de agendamiento veterinario habituales:

| Mejora | Que hace |
| ------ | -------- |
| Proximo turno en el buscador | Cada tarjeta muestra el primer horario libre de los proximos 14 dias ("Hoy 15:00") y un boton para agendar directo. |
| Mascotas del dueño | Registrar, editar y quitar mascotas (`/mascotas`). Al agendar se elige la mascota; el veterinario ve su nombre y especie en la agenda. |
| Recordatorios | Cada 10 minutos el backend avisa al cliente y al veterinario de las citas de las proximas 24 horas (una sola vez por cita). Son avisos dentro de la plataforma; para correo o WhatsApp habria que conectar un proveedor en `reminder.service.js`. |
| Reseñas | Despues de una cita atendida el cliente califica de 1 a 5 con comentario opcional. El promedio y las ultimas opiniones se ven en el perfil y en el buscador. |
| Horario por dia | "Mi horario" muestra una fila por dia con su interruptor "Atiende" y sus franjas. |
| Dias con turnos | Al agendar se muestran los proximos 14 dias como botones con la cantidad de turnos libres; los dias sin turnos no se pueden elegir. |
| Politica de cancelacion | El cliente cancela hasta 2 horas antes (`CLIENT_CANCEL_MIN_HOURS`). Despues solo el veterinario puede cancelar. Se informa al agendar y en la cita. |
| Filtros del buscador | Zona o barrio, precio maximo, "con turnos hoy" y orden por proximo turno, precio o calificacion. |
| Perfil del veterinario | "Mi perfil" permite editar especialidad, presentacion, telefono, modalidades y direccion, subir una foto y la tarjeta profesional. El perfil publico muestra un mapa del consultorio. |
| Panel del administrador | Paginacion, pendientes primero y boton "Ver tarjeta" para revisar el documento profesional antes de aprobar. |

Archivos subidos: las fotos se guardan en `backend/uploads/photos` y se sirven en `/uploads/photos`.
Las tarjetas profesionales se guardan en `backend/uploads/docs` y **no** son publicas: solo se
descargan con `GET /api/admin/users/:id/license-doc`. La carpeta `uploads/` esta en `.gitignore`. El modelo `Pet` ya existe en la base de datos.

## Roles

| Rol           | Como se crea                                   | Que puede hacer                                     |
| ------------- | ---------------------------------------------- | --------------------------------------------------- |
| `CLIENT`      | Registro normal (es el valor por defecto)      | Buscar veterinarios, ver perfiles y agendar citas    |
| `VETERINARIAN`| Registro eligiendo "Veterinario" (AN-7)        | Publicar su perfil y servicios, consultar su agenda  |
| `ADMIN`       | Script `npm run create-admin` (no se registra) | Aprobar veterinarios y gestionar cuentas (Sprint 2)  |

### Estado de la cuenta (Sprint 2)

| Estado      | Significado                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| `PENDING`   | Veterinario recien registrado. Entra, pero ve su panel bloqueado y no aparece en el buscador. |
| `ACTIVE`    | Cuenta habilitada. Los clientes nacen en este estado.                        |
| `SUSPENDED` | Bloqueada por el administrador. No puede iniciar sesion y su token deja de servir. |
| `REJECTED`  | Registro de veterinario rechazado. No puede iniciar sesion.                  |

Crear el administrador (desde `backend/`):

```
npm run create-admin -- "Nombre Admin" admin@animalcare.com Admin123
```

Al registrarse, el veterinario carga su matricula, especialidad, modalidades de atencion y,
opcionalmente, su catalogo de servicios. El sistema le crea automaticamente un horario inicial de
**lunes a viernes, de 09:00 a 13:00 y de 14:00 a 18:00**, para que quede disponible desde el primer
momento.

## Tecnologias

| Capa          | Tecnologia                                  |
| ------------- | ------------------------------------------- |
| Frontend      | React, Vite, JavaScript, React Router, Axios, CSS |
| Backend       | Node.js, Express, JavaScript, Prisma ORM, JWT, bcrypt |
| Base de datos | MySQL                                       |
| Herramientas  | Git, GitHub, Postman                        |

## Arquitectura

```
Usuario
   |
   v
React + Vite (Frontend)
   |
   | HTTP / JSON
   v
Node.js + Express (API REST)
   |
   v
Prisma ORM
   |
   v
MySQL
```

## Modelo de datos

```
User (id, name, email, password, role)
 |
 |-- 1:1 --> VetProfile (matricula, especialidad, modalidades, direccion)
 |              |-- 1:N --> Service       (nombre, precio, duracion)
 |              |-- 1:N --> Availability  (dia de la semana, hora inicio, hora fin)
 |              |-- 1:N --> Appointment
 |
 |-- 1:N --> Appointment (modalidad, fecha y hora, duracion, estado)
 |
 |-- 1:N --> Pet (preparado para el siguiente sprint)
```

## Reglas de la agenda

- Los bloques de la agenda son de **30 minutos**.
- La duracion de la cita la define el servicio elegido. Sin servicio, la consulta dura 30 minutos.
- Una cita solo cabe si entra completa dentro de una franja de atencion del veterinario.
- Un horario deja de ofrecerse si se cruza con una cita en estado `PENDING` o `CONFIRMED`.
  Una cita cancelada libera el horario.
- No se pueden agendar horarios que ya pasaron, ni con mas de **60 dias** de anticipacion.
- **Todas las fechas y horas se manejan en UTC.** El frontend envia y recibe siempre `AAAA-MM-DD`
  y `HH:MM`, de modo que la hora que elige el cliente es exactamente la que se guarda.

## Requisitos

- Node.js 18 o superior
- npm
- MySQL 8
- Git

## Estructura

```
animalcare/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── controllers/  (auth, health, vet, appointment)
│   │   ├── middleware/   (auth, role)
│   │   ├── routes/       (auth, health, vet, appointment)
│   │   ├── services/     (auth, vet, appointment)
│   │   ├── utils/        (schedule, params)
│   │   ├── app.js
│   │   └── prisma.js
│   ├── .env            (ignorado por Git)
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/   (Alerta, AuthLayout, Cabecera, Carrusel, CitaTarjeta, Huella, RutaPrivada)
│   │   ├── pages/        (Login, Register, Dashboard, Veterinarios, VeterinarioDetalle,
│   │   │                  AgendarCita, MisCitas)
│   │   ├── services/     (api.js, auth.service.js, vet.service.js, appointment.service.js)
│   │   ├── App.jsx       (rutas)
│   │   ├── index.css     (estilos base)
│   │   ├── paneles.css   (pantallas privadas)
│   │   └── auth.css      (pantallas de autenticacion)
│   └── package.json
├── docs/
├── .gitignore
└── README.md
```

## Variables de entorno

El backend usa `backend/.env`, que **no se sube al repositorio**. Se parte de `backend/.env.example`:

```
DATABASE_URL="mysql://root:tu_password@localhost:3306/animalcare"
PORT=4000
JWT_SECRET="una_clave_larga_y_secreta"
JWT_EXPIRES_IN="2h"
```

### Variables opcionales del backend

| Variable | Por defecto | Uso |
| -------- | ----------- | --- |
| `CLIENT_CANCEL_MIN_HOURS` | `2` | Horas antes de la cita hasta las que el cliente puede cancelar |
| `REMINDERS_ENABLED` | `true` | `false` desactiva los recordatorios (por ejemplo en un servidor de pruebas) |
| `REMINDER_INTERVAL_MS` | `600000` | Cada cuanto se revisan las citas para recordar |
| `CLINIC_TIMEZONE` | `America/Bogota` | Zona horaria de la agenda |

## Instalacion

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## Base de datos

```bash
cd backend
npx prisma migrate dev    # crea las tablas a partir de schema.prisma
npx prisma studio         # visor web de los datos (opcional)
```

## Ejecucion

```bash
# Backend -> http://localhost:4000
cd backend
npm run dev

# Frontend -> http://localhost:5173
cd frontend
npm run dev
```

## Endpoints

| Metodo | Ruta                     | Privada | Rol      | Descripcion                                      |
| ------ | ------------------------ | ------- | -------- | ------------------------------------------------ |
| GET    | /api/health              | No      | -        | Comprueba API y conexion con MySQL               |
| POST   | /api/auth/register       | No      | -        | Registra un cliente (AN-6) o un veterinario (AN-7) |
| POST   | /api/auth/login          | No      | -        | Valida credenciales y devuelve un JWT (AN-8)     |
| GET    | /api/auth/me             | Si      | Cualquiera | Devuelve el usuario del token                  |
| GET    | /api/vets                | Si      | Cualquiera | Lista veterinarios activos con `nextSlot`. Filtros: `q` (AN-27), `specialty`, `mode`, `zone`, `maxPrice`, `today=true`, `sort=next\|price\|rating` |
| GET    | /api/vets/:id/days       | Si      | Cualquiera | Proximos 14 dias con la cantidad de turnos libres. Filtros `mode`, `serviceId` |
| GET    | /api/vets/:id            | Si      | Cualquiera | Perfil detallado con servicios y horario (AN-26) |
| GET    | /api/vets/:id/slots      | Si      | Cualquiera | Horarios libres de un dia (AN-13)                |
| POST   | /api/appointments        | Si      | CLIENT   | Agenda una cita (AN-10, AN-11, AN-13)            |
| GET    | /api/appointments        | Si      | Cualquiera | Citas del cliente, o agenda del veterinario. Filtros `date`, `status` (AN-17) |
| PATCH  | /api/appointments/:id/cancel | Si  | CLIENT, VETERINARIAN | Cancela una cita propia y libera el horario (AN-14, AN-15). Body opcional `{ reason }` |
| PATCH  | /api/appointments/:id/reschedule | Si | VETERINARIAN | Mueve la cita a otro horario libre `{ date, time, reason? }` (AN-16) |
| PATCH  | /api/appointments/:id/confirm | Si | VETERINARIAN | Confirma una cita pendiente (AN-16)         |
| PATCH  | /api/appointments/:id/complete | Si | VETERINARIAN | Marca como atendida una cita cuya hora ya llego (AN-16) |
| POST   | /api/appointments/:id/review | Si  | CLIENT   | Califica una cita atendida `{ rating: 1-5, comment? }` |
| GET    | /api/medical-records/pets/:petId | Si | CLIENT, VETERINARIAN | Historia clinica de una mascota (AN-21) |
| POST   | /api/medical-records     | Si      | VETERINARIAN | Crea una entrada (AN-18)                     |
| PUT    | /api/medical-records/:id | Si      | VETERINARIAN | Modifica una entrada propia (AN-20)          |
| PATCH  | /api/medical-records/:id/annul | Si | VETERINARIAN | Elimina (anula) una entrada propia `{ reason }` (AN-19) |
| GET    | /api/pets                | Si      | CLIENT   | Mascotas activas del dueño                       |
| POST   | /api/pets                | Si      | CLIENT   | Registra una mascota `{ name, species, sex, birthDate, weight? }` |
| PUT    | /api/pets/:id            | Si      | CLIENT   | Actualiza una mascota propia                     |
| DELETE | /api/pets/:id            | Si      | CLIENT   | Quita la mascota de la lista (sus citas se conservan) |
| GET    | /api/vets/me/profile     | Si      | VETERINARIAN | Perfil propio                                |
| PUT    | /api/vets/me/profile     | Si      | VETERINARIAN | Edita especialidad, presentacion, telefono, modalidades y direccion |
| PUT    | /api/vets/me/photo       | Si      | VETERINARIAN | Sube la foto `{ image: dataURL }` (JPG, PNG o WEBP, max. 3 MB) |
| DELETE | /api/vets/me/photo       | Si      | VETERINARIAN | Quita la foto                                |
| PUT    | /api/vets/me/license-doc | Si      | VETERINARIAN | Sube la tarjeta profesional `{ file: dataURL }` (PDF, JPG o PNG, max. 5 MB) |
| GET    | /api/vets/me/services    | Si      | VETERINARIAN | Servicios propios (AN-28)                    |
| POST   | /api/vets/me/services    | Si      | VETERINARIAN | Agrega un servicio (AN-28, AN-30)            |
| PUT    | /api/vets/me/services/:serviceId | Si | VETERINARIAN | Edita nombre, precio o duracion (AN-30)   |
| DELETE | /api/vets/me/services/:serviceId | Si | VETERINARIAN | Elimina un servicio (AN-29)               |
| GET    | /api/vets/me/availability | Si     | VETERINARIAN | Horario semanal propio (AN-31)               |
| PUT    | /api/vets/me/availability | Si     | VETERINARIAN | Reemplaza el horario semanal (AN-31)         |
| GET    | /api/vets/me/blocks      | Si      | VETERINARIAN | Proximos bloqueos (AN-31)                    |
| POST   | /api/vets/me/blocks      | Si      | VETERINARIAN | Bloquea un dia o rango de horas; 409 `BLOCK_CONFLICT` si hay citas, reenviar con `confirm: true` (AN-31) |
| DELETE | /api/vets/me/blocks/:blockId | Si  | VETERINARIAN | Quita un bloqueo (AN-31)                     |
| GET    | /api/notifications       | Si      | Cualquiera | Ultimas notificaciones del usuario             |
| PATCH  | /api/notifications/:id/read | Si   | Cualquiera | Marca una notificacion como leida              |
| PATCH  | /api/notifications/read-all | Si   | Cualquiera | Marca todas como leidas (AN-22, AN-23)         |
| GET    | /api/admin/users         | Si      | ADMIN    | Listado paginado (`page`, `pageSize`) con filtros `status`, `role`, `q` (AN-38) |
| GET    | /api/admin/users/:id/license-doc | Si | ADMIN | Descarga la tarjeta profesional de un veterinario |
| PATCH  | /api/admin/users/:id/approve | Si  | ADMIN    | Aprueba un veterinario (AN-35)                   |
| PATCH  | /api/admin/users/:id/reject | Si   | ADMIN    | Rechaza un veterinario pendiente (AN-35)         |
| PATCH  | /api/admin/users/:id/suspend | Si  | ADMIN    | Suspende una cuenta activa (AN-37)               |
| PATCH  | /api/admin/users/:id/reactivate | Si | ADMIN  | Reactiva una cuenta suspendida (AN-37)           |

Las rutas privadas requieren la cabecera:

```
Authorization: Bearer <token>
```

### Registrar un veterinario (AN-7)

```json
POST /api/auth/register
{
  "name": "Dra. Carla Rios",
  "email": "carla@animalcare.com",
  "password": "vet12345",
  "role": "VETERINARIAN",
  "license": "MV-12345",
  "specialty": "Medicina general",
  "bio": "Diez anios atendiendo perros y gatos.",
  "phone": "3001234567",
  "address": "Calle 10 # 5-20",
  "homeService": true,
  "clinicService": true,
  "services": [
    { "name": "Consulta general", "price": 60000, "durationMinutes": 30 },
    { "name": "Vacunacion", "price": 85000, "durationMinutes": 60 }
  ]
}
```

Omitir `role` (o enviar `"CLIENT"`) registra un cliente y los datos profesionales se ignoran.

### Consultar horarios libres (AN-13)

```
GET /api/vets/1/slots?date=2026-09-23&mode=CLINIC&serviceId=1
```

```json
{
  "date": "2026-09-23",
  "mode": "CLINIC",
  "durationMinutes": 30,
  "total": 16,
  "slots": ["09:00", "09:30", "10:00", "..."]
}
```

### Agendar una cita (AN-10 / AN-11 / AN-13)

```json
POST /api/appointments
{
  "vetProfileId": 1,
  "serviceId": 1,
  "mode": "CLINIC",
  "date": "2026-09-23",
  "time": "09:00",
  "notes": "Mi gato esta decaido"
}
```

Con `"mode": "HOME"` el campo `address` es obligatorio: es la direccion donde se atendera a la mascota.

### Codigos de respuesta

| Codigo | Cuando                                                                 |
| ------ | ---------------------------------------------------------------------- |
| 400    | Datos invalidos, modalidad que el veterinario no ofrece, hora fuera de su horario |
| 401    | Falta el token, o esta vencido o manipulado                            |
| 403    | El rol no tiene permiso (por ejemplo, un veterinario intentando agendar) |
| 404    | El veterinario o el servicio no existe                                 |
| 409    | El horario ya fue tomado por otra persona                              |

## Rutas del frontend

| Ruta                          | Privada | Descripcion                                     |
| ----------------------------- | ------- | ----------------------------------------------- |
| /login                        | No      | Inicio de sesion (AN-8)                         |
| /register                     | No      | Registro de cliente o veterinario (AN-6, AN-7)  |
| /dashboard                    | Si      | Panel, distinto segun el rol                    |
| /veterinarios                 | Si      | Listado con filtros por especialidad y modalidad |
| /veterinarios/:id             | Si      | Perfil detallado y servicios (AN-26)            |
| /veterinarios/:id/agendar     | Si      | Modalidad, fecha y hora (AN-10, AN-11, AN-13)   |
| /citas                        | Si      | Cliente: proximas e historial, con cancelacion (AN-14). Veterinario: agenda por dia con confirmar, reprogramar y cancelar (AN-15, AN-16, AN-17) |
| /notificaciones               | Si      | Avisos del usuario (AN-22, AN-23)              |
| /mascotas                     | Si      | Cliente: sus mascotas                          |
| /mascotas/:id/historia        | Si      | Cliente: historia clinica de su mascota (AN-21) |
| /pacientes/:id                | Si      | Veterinario: historia clinica de un paciente (AN-18, AN-19, AN-20) |
| /mi-perfil                    | Si      | Veterinario: perfil, foto y tarjeta profesional |
| /mis-servicios                | Si      | Veterinario: agregar, editar y eliminar servicios (AN-28, AN-29, AN-30) |
| /mi-horario                   | Si      | Veterinario: horario semanal y bloqueos (AN-31) |
| /admin/usuarios               | Si      | Administrador: usuarios, aprobacion y suspension (AN-35, AN-37, AN-38) |

Los creditos y licencias de las fotografias utilizadas estan en
[docs/creditos-imagenes.md](docs/creditos-imagenes.md).

## Pruebas

Las pruebas de la API se realizan con Postman. La documentacion de casos de prueba y evidencias
se guardara en la carpeta `docs/`.

Ademas, `backend/tests/sprint2.test.js` recorre automaticamente los criterios de aceptacion del
Sprint 2, de las historias relacionadas y de las mejoras contra la API (98 casos). Con el backend corriendo, desde `backend/`:

```
npm test
```

Por defecto usa `http://localhost:4000/api` (se cambia con la variable `API_URL`). Crea sus propios
usuarios (`qa.sprint2.*`) y los borra al terminar, junto con sus citas, servicios, horarios,
bloqueos y notificaciones.
