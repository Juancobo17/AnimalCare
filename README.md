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

La gestion de mascotas (registrar, listar, actualizar y desactivar) queda planificada para un sprint
posterior. El modelo `Pet` ya existe en la base de datos.

## Roles

| Rol           | Como se crea                                   | Que puede hacer                                     |
| ------------- | ---------------------------------------------- | --------------------------------------------------- |
| `CLIENT`      | Registro normal (es el valor por defecto)      | Buscar veterinarios, ver perfiles y agendar citas    |
| `VETERINARIAN`| Registro eligiendo "Veterinario" (AN-7)        | Publicar su perfil y servicios, consultar su agenda  |

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
| GET    | /api/vets                | Si      | Cualquiera | Lista veterinarios. Filtros: `specialty`, `mode` |
| GET    | /api/vets/:id            | Si      | Cualquiera | Perfil detallado con servicios y horario (AN-26) |
| GET    | /api/vets/:id/slots      | Si      | Cualquiera | Horarios libres de un dia (AN-13)                |
| POST   | /api/appointments        | Si      | CLIENT   | Agenda una cita (AN-10, AN-11, AN-13)            |
| GET    | /api/appointments        | Si      | Cualquiera | Citas del cliente, o agenda del veterinario      |

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
| /citas                        | Si      | Citas del cliente o agenda del veterinario      |

Los creditos y licencias de las fotografias utilizadas estan en
[docs/creditos-imagenes.md](docs/creditos-imagenes.md).

## Pruebas

Las pruebas de la API se realizan con Postman. La documentacion de casos de prueba y evidencias
se guardara en la carpeta `docs/`.
