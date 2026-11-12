# SPEC — Fútbol 360

> Documento vivo y **fuente única de contexto** para `futbol360-api` y `futbol360-app`.
> Describe QUÉ hace el producto y el contrato entre app y API.
> Las secciones §3 y §5 reflejan el código actual (revisado el 2026-11-12).
> Lo marcado **[CONFIRMAR]** es una inferencia del código que el dueño del producto debe validar:
> los agentes lo leen pero no deben tomarlo como requisito cerrado.

## 1. Visión
Plataforma para que ligas de fútbol amateur gestionen sus campeonatos: categorías,
equipos, jugadores, generación automática de fixture, vocalía (acta) de cada partido con sus
eventos (goles, tarjetas, cambios) y tabla de posiciones.
Es **multi-liga**: cada liga tiene un `code` con el que sus usuarios inician sesión, y todos los
datos quedan aislados por liga.

## 2. Usuarios y roles
Roles reales (`UserRole` en `src/models/users.ts`). Un usuario puede tener varios roles y pertenecer
a varias ligas (`leagues[]`).

| Rol | Valor | Qué puede hacer hoy (según el código) |
|---|---|---|
| Visitante | — | Nada: no hay endpoints públicos salvo `/`, `/health` y login.  si habrá vista pública de resultados/tablas, para que cualquiera pueda visualizar |
| Master | `master` | Superadministrador. Único que entra por `/auth/admin/login`. Gestiona ligas. Puede entrar a cualquier liga |
| Administrador | `admin` | Administra su liga. Puede gestionar `/leagues` |
| Directivo | `directivo` | permisos; hoy tiene el mismo acceso que cualquier usuario autenticado, pero a futuro esta por implementar que los directivos sean quienes crean campeonatos, cetegorias, equipos y jugadores, como tambien gestionar los partidos y vocalias. |
| Oficial | `official` | Árbitro / asistente / vocal según flags `official.canReferee`, `canAssist`, `canBeVocal` |
| Jugador | `player` | SOlo deberia poder registrarse, en un equipo, cuando un directivo cree un enlace en el que cada jugador se vaya registrando en el equipo |

> Hoy solo `/leagues` está restringido por rol (`master`, `admin`). El resto de rutas solo exige JWT.

## 3. Entidades del dominio
Todas (excepto User y League) tienen `league` (ref, requerido) y todas tienen `_movements`
(historial de auditoría `{ type, date, user, nota }`).

### League — `leagues`
- `code` (único, usado en el login), `name` (único), `status` (`activo|inactivo`), `description`, `logo`
- Al crearla se asocia automáticamente al usuario creador (`user.leagues.push`).

### User — `users`
- `name`, `username` (único), `email` (único), `password` (hash bcrypt), `roles[]`, `leagues[]`
- `official { canReferee, canAssist, canBeVocal }`, `status` (`activo|inactivo`), timestamps
- Al crearlo se asocia a la liga del JWT y se envía correo de bienvenida con usuario y contraseña.

### Category — `categories`
- `name`, `status`, `minAge`, `maxAge`

### Team — `teams`
- `name`, `representative` (req.), `fundacion` (fecha), `logo` (publicId Cloudinary), `phone`
- `directorio { presidente, vicepresidente, secretario, tesorero }`, `status`

### Player — `players`
- `team` (ref), `cedula` (única, mín. 10 caracteres), `names`, `lastName`, `birthDate`, `jerseyNumber`
- `photo` (publicId Cloudinary), `status`
- `position`: `portero | defensa | lateral_derecho | lateral_izquierdo | volante | mediocampista | extremo_derecho | extremo_izquierdo | delantero`

### Championship — `championships`
- `name`, `category` (ref), `season` (fecha), `type` (`temporada|apertura|clausura|copa|amistoso`)
- `startDate`, `endDate`, `status` (`planificado|activo|finalizado|cancelado`, por defecto `activo`)
- `teams[]`: `{ team, status (activo|retirado|expulsado), fechaIngreso, fechaSalida, finalPosition, points, notes }`
- `stages[]` (etapas): `{ order, name, mode, status, participants, qualifyTeams, groups, thirdPlaceMatch }`
  - `mode`: `round_robin` (una vuelta) | `round_robin_double` (ida y vuelta) | `groups` | `knockout`
  - `status`: `pendiente → generada → en_juego → finalizada`
- `currentStage`, `champion`, `runnerUp`, `thirdPlace` (refs a Team), `observations`

### Round (Jornada) — `rounds`
- `championship`, `stage` (id de etapa), `round` (número), `name` (“Jornada N” o nombre de la etapa), `group`
- `status`: `pendiente → en_juego → finalizado`

### Match (Partido) — `matches`
- `championship`, `round`, `stage`, `localTeam`, `visitorTeam`, `date`, `hour`
- `vocal`, `referee`, `assistantReferees[]` (refs a User), `matchReport` (ref)
- `localGoals`, `visitorGoals` (por defecto 0), `observations`
- `status`: `programado → en_juego → finalizado | suspendido`

### MatchReport (Vocalía / acta) — `matchreports`
- Uno por partido (`match` único). `championship`, `stage`, `round`
- `status`: `borrador | en_juego | finalizada`; `startTime`, `endTime`
- `referee`, `assistantReferees[]`, `vocal`, `income` (recaudación), `refereeRating` (`muy_buena|buena|regular|mala`)
- `refereeReport`, `vocalReport`, `observations`
- `local` / `visitor`: `{ team, captain, captainArmband, dressingRoomClean, dressingRoomEquipment, players[], observations }`

### MatchEvent (Evento de partido) — `matchevents`
- `vocalia` (ref MatchReport), `match`, `championship`, `stage`, `round`, `team`, `player`
- `minute` (0–130), `type`: `gol | autogol | gol_penal | penal_fallado | tarjeta_amarilla | tarjeta_roja | cambio`
- `playerIn`, `playerOut` (solo cambios), `observations`

## 4. Reglas de negocio (implementadas)
**Puntos y tabla** (`competicion/standings.ts`, `rankings.ts`)
- Victoria = 3, empate = 1, derrota = 0.
- Cuentan los partidos en estado `en_juego`, `finalizado` y `suspendido`.
- Desempate: puntos → diferencia de goles → goles a favor → partidos ganados → id del equipo.
- Las etapas `knockout` no tienen tabla.

**Fixture** (`competicion/`)
- La etapa 1 usa los equipos `activo` del campeonato; las siguientes, los `qualifyTeams` primeros de la tabla de la etapa anterior, y exige `participants` = `qualifyTeams` anterior.
- Round robin: algoritmo de rotación con equipos barajados; si son impares se agrega “descanso”. Ida y vuelta invierte la localía en la vuelta.
- Round robin exige: `participants` definido, nº de equipos = `participants`, `qualifyTeams < participants`, etapa en `pendiente`.
- Knockout: `participants` potencia de 2; crea una sola jornada con cruces 1º vs último, 2º vs penúltimo…
- `groups` **no está implementado** (funciones vacías).
- Generar fixture pone la etapa en `generada`. Borrar fixture solo si no hay vocalías ni partidos en juego/finalizados; la etapa vuelve a `pendiente`.
- Una etapa solo se elimina si está `pendiente` y no tiene jornadas.

**Flujo de un partido**
1. `POST /matchs/:id/start`: el partido debe estar `programado` y pertenecer a la jornada actual (la `en_juego` o, si no hay, la primera `pendiente`). Crea la vocalía en `en_juego`, el partido pasa a `en_juego`, la jornada a `en_juego` y la etapa de `generada` a `en_juego`.
2. Se registran eventos (`/matchs-events`). No se permiten si la vocalía está `finalizada`. Cada `gol` recalcula el marcador contando eventos `gol` por equipo.
3. `POST /matchs-reports/:id/finalizar` con `status: finalizado|suspendido`: cierra la vocalía, actualiza el partido; si no quedan partidos abiertos en la jornada, la jornada pasa a `finalizado`; si no quedan jornadas abiertas, la etapa pasa a `finalizada`.
4. `DELETE /matchs/:id/revert-start`: solo si la vocalía no tiene eventos ni datos registrados; borra la vocalía y devuelve el partido a `programado` (y jornada/etapa si no hay otros partidos en juego).

**Otras**
- Un campeonato no se puede eliminar si tiene equipos o partidos.
- Login de liga: el usuario debe pertenecer a la liga del `code` (o ser `master`) y estar `activo`. Token válido 7 días.

## 5. API (contrato app ↔ API)
- Base: la API no usa prefijo; la app la llama como `/api/...` (rewrite de Next).
- Auth: header `Authorization: Bearer <token>`. Payload JWT: `{ user, username, roles, league }` (`league` falta en el token de admin).
  - 401 `{ message: "La sesión ha expirado", code: "TOKEN_EXPIRED" }` o `{ message: "Token inválido", code: "INVALID_TOKEN" }`
  - 403 `{ message: "No tienes permisos para acceder a este recurso" }`
- Formato de error general: `{ success: false, message, code }` (status del `FastifyError`, 500 si no tiene).
- Formato de lista (UpRouter): `{ page, total, data: T[] }`.
  Query: `page`, `limit` (por defecto 20), `sort` (ej. `-date`), `fields`, `q` (búsqueda), y cualquier campo como filtro (ej. `?championship=<id>&status=programado`).
  Operadores en filtros (mongoose-smart-query, usados por la app): `campo={$in}a,b`, `date={$gte}<iso>{$lte}<iso>`; `$getAllFields=true` devuelve todos los campos.
- `GET /:id` devuelve el documento (404 si no existe en la liga). `DELETE /:id` devuelve el texto `"success"`.
- `GET /<recurso>/get-options` devuelve opciones de enums si el modelo las define (hoy `{}`).

### CRUD genérico (UpRouter) — todos requieren JWT
`GET /` · `GET /:id` · `POST /` · `PUT /:id` · `DELETE /:id` · `GET /get-options` en:

| Prefijo | Recurso | Notas |
|---|---|---|
| /leagues | League | Solo `master`/`admin` |
| /users | User | POST y PUT propios (hash de contraseña, correo de bienvenida) |
| /categories | Category | |
| /teams | Team | |
| /players | Player | |
| /championships | Championship | |
| /rounds | Round | |
| /matchs | Match | |
| /matchs-reports | MatchReport | PUT propio (deep-merge sin auditoría) |
| /matchs-events | MatchEvent | |

### Endpoints específicos
| Método | Ruta | Auth | Body / Query | Respuesta |
|---|---|---|---|---|
| GET | / | — | — | `{ success: true, message: "Futbol360 API" }` |
| GET | /health | — | — | `{ status, database, uptime, timestamp }` (503 si Mongo caído) |
| GET | /docs | — | — | Swagger UI |
| POST | /auth/login | — | `{ code, username, password }` | `{ token, user: { id, name, roles, official, league, nameLiga, code } }` |
| POST | /auth/admin/login | — | `{ username, password }` | `{ token, user: { id, name, roles } }` (solo `master`) |
| GET | /users/me | JWT | — | `{ code, liga, status, logo, user: { name, roles, leagues } }` |
| GET | /dashboard | JWT | — | `{ campeonatos, categorias, equipos, partidos, jugadores, usuarios }` (conteos de la liga) |
| GET | /leagues/dashboard | JWT master/admin | — | Igual que `/dashboard` |
| GET | /teams/:id/groups | JWT | — | `[{ position: "Porteros", players: [...] }]` jugadores agrupados por posición |
| POST | /teams/:id/image | JWT | multipart (archivo, ≤5MB) | `{ publicId, url }` (logo) |
| GET | /teams/:id/image | JWT | — | `{ publicId, url }` |
| DELETE | /teams/:id/image | JWT | — | `{ success: true }` |
| POST/GET/DELETE | /players/:id/image | JWT | igual que teams | foto del jugador |
| POST | /championships/:id/stages | JWT | `{ name, mode, participants?, qualifyTeams?, groups?, thirdPlaceMatch? }` | `{ message }` |
| GET | /championships/:id/stages | JWT | — | `ChampionshipStage[]` |
| PUT | /championships/:id/stages/:stageId | JWT | campos parciales de la etapa | `{ message }` |
| DELETE | /championships/:id/stages/:stageId | JWT | — | `{ message }` |
| POST | /championships/:id/generate-fixture/:stageId | JWT | — | `{ message: "Fixture generado correctamente" }` |
| DELETE | /championships/:id/delete-fixture/:stageId | JWT | — | `{ message }` |
| GET | /championships/:id/table-positions | JWT | `?stageId=` (opcional; si no, la primera etapa en juego/finalizada) | `[{ team, name, logo, played, wins, draws, losses, goalsFor, goalsAgainst, goalDifference, points, position }]` |
| POST | /matchs/:id/start | JWT | — | La vocalía (MatchReport) creada |
| DELETE | /matchs/:id/revert-start | JWT | — | `{ success: true, data: match }` |
| PUT | /matchs-reports/:id | JWT | campos parciales de la vocalía | vocalía actualizada |
| POST | /matchs-reports/:id/finalizar | JWT | `{ status: "finalizado" \| "suspendido" }` | `"Vocalia finalizada"` |

## 6. Pantallas de la app
Revisado en `futbol360-app` el 2026-11-12. Todas requieren JWT salvo el login.

**Login — `app/(login)`**
| Ruta | Descripción | Datos que usa |
|---|---|---|
| / | Redirige a /login | — |
| /login | Login de usuarios de liga (código de liga + usuario + contraseña) → /dashboard | POST /auth/login |
| /admin/login | Login del master → /users | POST /auth/admin/login |

**Administración (master/admin) — `app/(admin)`**
| Ruta | Descripción | Datos que usa |
|---|---|---|
| /home | Inicio admin | GET /dashboard/admin/statics (**no existe en la API**), GET /leagues |
| /leagues | Listado y gestión de ligas | GET/POST/PUT /leagues |
| /users | Usuarios (master) | GET/POST/PUT/DELETE /users, GET /leagues |

**Liga — `app/(usuarios)`**
| Ruta | Descripción | Datos que usa |
|---|---|---|
| /dashboard | Conteos de la liga | GET /dashboard |
| /categories | CRUD de categorías (modal) | /categories |
| /teams, /teams/insert, /teams/[id]/edit | Equipos, logo, plantilla por posición | /teams, /teams/:id/image, /teams/:id/groups |
| /players, /players/insert, /players/[id]/edit | Jugadores y foto | /players, /players/:id/image, /teams (select) |
| /campeonatos, /campeonatos/insert, /campeonatos/[id]/edit | Campeonatos, categoría y equipos inscritos | /championships, /categories, /teams |
| /campeonatos/[id]/gestionar | Etapas, generar/borrar fixture, jornadas, programar partidos (fecha, vocal, árbitros), iniciar/revertir partido, tabla de posiciones | /championships/:id, /championships/:id/stages, generate-fixture, delete-fixture, /rounds, /matchs, PUT /matchs/:id, /matchs/:id/start, revert-start, /users (oficiales), table-positions |
| /campeonatos/[id]/vocalia/[vocaliaId] | Vocalía en vivo: cronómetro, eventos, alineaciones, capitanes, informes, recaudación, finalizar | /matchs-reports/:id (GET/PUT), /matchs-reports/:id/finalizar, /matchs/:id, /matchs-events (CRUD), /players |
| /matchs | "Mis partidos" del oficial (filtra `vocal = usuario`) e inicio de vocalía | GET /matchs, /matchs/:id/start, revert-start |
| /history | Historial de partidos finalizados/suspendidos como árbitro, asistente o vocal, por rango de fechas | GET /matchs |
| /usuarios | Usuarios de la liga (admin) | /users |

**Enlaces de menú sin página todavía:** `/referees`, `/vocals`, `/statistics` (directivo y player), `/team` (player).

## 7. Requisitos no funcionales
- Responsive: layout con `Drawer` en móvil (antd `useBreakpoint`, corte en `lg`)
- Node ≥ 20 para la app (Next 16)
-  moneda y formato: la app formatea con `es-ES` / `USD` (`app/assets/utils.tsx`)
- Imágenes ≤ 5 MB (límite de multipart). formatos permitidos: jpg/png/webp Todos los formatos,mas comunes
- Imágenes servidas desde Cloudinary, carpeta `futbol360/teams` y `futbol360/players`
- MongoDB en replica set (transacciones en fixture y sesiones)
- Mensajes al usuario en español
- Siempre quede responsive / móvil primero, rendimiento, accesibilidad

## 8. Fuera de alcance (por ahora)
-  Registro público de usuarios (hoy los usuarios los crea un admin; no existe `/auth/register`) asi esta correcto solo un admin crear usuarios

## 9. Decisiones tomadas
- 2026-11-12 — `SPEC.md` y `specs/` viven en `futbol360-api` y son la fuente única de contexto para API y app. La app los referencia como `../futbol360-api/` (ambos repos son carpetas hermanas).
- (Inferida del código) App 100% cliente con antd + zustand; protección de rutas en layouts, sin middleware.
- (Inferida del código) Imágenes en la app con `cloudinaryUrl()` + `Avatar` de antd, no `next/image`.
- (Inferida del código) Multi-liga por `league` en cada documento, aislado vía JWT.
- (Inferida del código) Imágenes: se guarda el `publicId` de Cloudinary y la URL se construye al leer.
- (Inferida del código) Auditoría con `_movements` en lugar de timestamps en la mayoría de modelos.
- Pendiente: ¿Zod (ya instalado) o JSON Schema de Fastify para validar endpoints nuevos?


**App ↔ API**
13. La app llama `GET /dashboard/admin/statics` (`app/(admin)/home/page.tsx`), que no existe en la API.
14. El layout `(admin)` redirige si `!isAdmin`, e `isAdmin` solo es true con el rol `admin`: un usuario solo `master` sería expulsado de `/users`. [VERIFICAR]
15. El menú tiene rutas sin página (`/referees`, `/vocals`, `/statistics`, `/team`).
16. `NEXT_PUBLIC_API_URL` hace que axios llame directo a la API desde el navegador, sin usar el rewrite `/api`.
17. Duplicados en la app: `assets/filtros.tsx` ≈ `assets/utils.tsx`; `Movement` en `types/global.ts` y `types/utils.ts`.
