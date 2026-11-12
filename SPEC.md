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

> Restricciones por rol hoy: `/leagues` (`master`, `admin`) y `PUT /matchs/:id/penalties`
> (`admin`, `directivo`). El resto de rutas solo exige JWT de la liga.

## 3. Entidades del dominio
Todas (excepto User y League) tienen `league` (ref, requerido) y todas tienen `_movements`
(historial de auditoría `{ type, date, user, nota }`).

### League — `leagues`
- `code` (único, usado en el login), `name` (único), `status` (`activo|inactivo`), `description`, `logo`
- Al crearla se asocia automáticamente al usuario creador (`user.leagues.push`).

### User — `users`
- `name`, `username` (único), `email` (único), `password` (hash bcrypt; `select: false`, nunca se serializa en respuestas ni en `smartQuery`), `roles[]`, `leagues[]` (ref League)
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
- `stages[]` (etapas): `{ order, name, mode, status, participants, qualifyTeams, groups, thirdPlaceMatch, groupsTeams }`
  - `mode`: `round_robin` (una vuelta) | `round_robin_double` (ida y vuelta) | `groups` | `knockout`
  - `status`: `pendiente → generada → en_juego → finalizada`
  - `groupsTeams`: `[{ name: "A", teams: [Team] }]`, composición de los grupos guardada al generar el fixture (solo `groups`)
- `currentStage` (última etapa generada), `champion`, `runnerUp`, `thirdPlace` (refs a Team, se asignan al finalizar), `observations`

### Round (Jornada) — `rounds`
- `championship`, `stage` (id de etapa), `round` (número), `name` (“Jornada N” o nombre de la etapa), `group`
- `status`: `pendiente → en_juego → finalizado`

### Match (Partido) — `matches`
- `championship`, `round`, `stage`, `localTeam`, `visitorTeam`, `date`, `hour`
- `vocal`, `referee`, `assistantReferees[]` (refs a User), `matchReport` (ref)
- `localGoals`, `visitorGoals` (por defecto 0), `observations`
- `localPenalties`, `visitorPenalties`: tanda de penales, solo para definir un empate en `knockout`
- `group`: grupo del partido (`groups`); `bracketPosition`: cruce en la llave (`knockout`, 1, 2, 3…);
  `isThirdPlaceMatch`: partido por el tercer lugar. Los partidos knockout anteriores al 2026-11-12 no tienen `bracketPosition`.
- `status`: `programado → en_juego → finalizado | suspendido`

### MatchReport (Vocalía / acta) — `matchreports`
- Uno por partido (`match` único). `championship`, `stage`, `round`
- `status`: `borrador | en_juego | finalizada`; `startTime`, `endTime`
- `referee`, `assistantReferees[]`, `vocal`, `income` (recaudación), `refereeRating` (`muy_buena|buena|regular|mala`)
- `refereeReport`, `vocalReport`, `observations`
- `local` / `visitor`: `{ team, captain, captainArmband, dressingRoomClean, dressingRoomEquipment, players[], observations }`

### MatchEvent (Evento de partido) — `matchevents`
- `vocalia` (ref MatchReport), `match`, `championship`, `stage`, `round`, `team`, `player`
- `minute` (0–130), `type`: `gol | tarjeta_amarilla | tarjeta_roja | cambio`
  (`autogol`, `gol_penal` y `penal_fallado` se quitaron el 2026-11-12; la app solo muestra eventos antiguos de `penal_fallado`)
- `playerIn`, `playerOut` (solo cambios), `observations`

## 4. Reglas de negocio (implementadas)
**Puntos y tabla** (`competicion/standings.ts`, `rankings.ts`)
- Victoria = 3, empate = 1, derrota = 0.
- Cuentan los partidos en estado `en_juego`, `finalizado` y `suspendido`.
- Desempate: puntos → diferencia de goles → goles a favor → partidos ganados → id del equipo.
- Las etapas `knockout` no tienen tabla.

**Fixture y etapas** (`competicion/`, orquestado por `championship.service.ts`)
- Participantes: la etapa 1 usa los equipos `activo` del campeonato (sorteados). Las siguientes usan los
  clasificados de la anterior, que debe estar `finalizada`, con `participants` = `qualifyTeams` anterior.
- Todas exigen etapa en `pendiente` y nº de equipos = `participants`. Se genera en una transacción.
- **Round robin / ida y vuelta**: método del círculo con equipos sorteados; con nº impar descansa un equipo
  por jornada. Localía repartida (con nº par, cada equipo es local la mitad de las fechas ±1 y nunca más
  de 2 seguidas). La vuelta repite la ida con la localía invertida. `qualifyTeams < participants`.
- **Grupos**: `groups` ≥ 2 y al menos 2 equipos por grupo. Reparto en serpentina: sorteo en la etapa 1,
  cabezas de serie si viene de otra etapa. Si no es exacto, los primeros grupos tienen un equipo más.
  Cada grupo juega todos contra todos a una vuelta; cada jornada incluye todos los grupos.
  `qualifyTeams` divisible entre los grupos. Clasifican los N primeros de cada grupo, ordenados entre sí
  (todos los 1º, luego los 2º…).
- **Knockout**: `participants` potencia de 2. Partido único, ronda por ronda: al generar se crea la primera
  ronda; al cerrar la última vocalía de una ronda se crea la siguiente con los ganadores (cruce 1 vs 2, 3 vs 4…).
  Siembra estándar (1º y 2º solo se cruzan en la final; 1º vs último). Si viene de grupos, se evita que se
  crucen equipos del mismo grupo. `thirdPlaceMatch`: el tercer lugar se juega en la misma jornada que la final.
  `qualifyTeams` (potencia de 2, menor que `participants`) detiene la etapa antes de la final; 1 o vacío = hasta la final.
- Rondas: "Cuartos de final", "Semifinal", "Final" ("Final y tercer lugar"); en ligas, "Jornada N".
- Generar pone la etapa en `generada` y `currentStage`. Borrar fixture: solo sin vocalías ni partidos
  jugados y con la etapa siguiente en `pendiente`; la etapa vuelve a `pendiente` (y se borran sus grupos).
- Una etapa solo se elimina si está `pendiente` y no tiene jornadas.
- Simulación end-to-end de todos los modos: `npm run simulate` (ver AGENTS.md).

**Penales (knockout)**
- Un empate en knockout se define por penales (`localPenalties` ≠ `visitorPenalties`); sin ellos la vocalía
  no se puede finalizar (ni como `suspendido`).
- Partidos ya cerrados empatados sin penales (anteriores a esta regla) o con penales mal registrados se corrigen con
  `PUT /matchs/:id/penalties` (`admin`, `directivo`). No se permite invertir al ganador si con ese resultado
  ya se generó la ronda o etapa siguiente.

**Fin del campeonato**
- Cuando termina la última etapa se asignan `champion`, `runnerUp`, `thirdPlace` y `teams[].finalPosition`;
  el campeonato pasa a `finalizado` con `endDate`.
  - Liga: 1º, 2º y 3º de la tabla. Knockout: ganador/perdedor de la final y ganador del tercer lugar.
  - Grupos como última etapa: no define campeón (debe haber una etapa final después).

**Límites actuales**: grupos solo a una vuelta; knockout solo a partido único (sin ida y vuelta);
en grupos de distinto tamaño unos equipos juegan más partidos.

**Flujo de un partido**
1. `POST /matchs/:id/start`: el partido debe estar `programado` y pertenecer a la jornada actual (la `en_juego` o, si no hay, la primera `pendiente`). Crea la vocalía en `en_juego`, el partido pasa a `en_juego`, la jornada a `en_juego` y la etapa de `generada` a `en_juego`.
2. Se registran eventos (`/matchs-events`). No se permiten si la vocalía está `finalizada`. Cada `gol` recalcula el marcador contando eventos `gol` por equipo.
3. `POST /matchs-reports/:id/finalizar` con `status: finalizado|suspendido` (+ penales si es knockout empatado):
   cierra la vocalía y el partido. Si no quedan partidos abiertos en la jornada, esta pasa a `finalizado` y el
   campeonato avanza solo (`afterRoundFinished`): en knockout crea la siguiente ronda; si no hay más, la etapa
   pasa a `finalizada` y, si era la última, se finaliza el campeonato.
4. `DELETE /matchs/:id/revert-start`: solo si la vocalía no tiene eventos ni datos registrados; borra la vocalía y devuelve el partido a `programado` (y jornada/etapa si no hay otros partidos en juego).

**Otras**
- Un campeonato no se puede eliminar si tiene equipos o partidos.
- Iniciar, revertir y finalizar partidos/vocalías solo opera sobre documentos de la liga del token.
- Login de liga: el usuario debe pertenecer a la liga del `code` (o ser `master`) y estar `activo`. Token válido 7 días.

## 5. API (contrato app ↔ API)
- Base: la API no usa prefijo; la app la llama como `/api/...` (rewrite de Next).
- Auth: header `Authorization: Bearer <token>`. Payload JWT: `{ user, username, roles, league }` (`league` falta en el token de admin).
  - 401 `{ message: "La sesión ha expirado", code: "TOKEN_EXPIRED" }` o `{ message: "Token inválido", code: "INVALID_TOKEN" }`
  - 403 `{ message: "No tienes permisos para acceder a este recurso" }`
- Formato de error general: `{ success: false, message, code }` (status del `FastifyError`, 500 si no tiene).
  Los errores de knockout nombran el partido: "El partido España 1 - 1 Juventus (Semifinal)…".
- CORS: cualquier origen; métodos `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS`.
- Swagger (`/docs`): OpenAPI 3 con botón **Authorize** (Bearer). Los POST/PUT del CRUD aceptan cualquier objeto JSON.
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
| /matchs | Match | por defecto incluye `group`, `bracketPosition`, `isThirdPlaceMatch`, `localPenalties`, `visitorPenalties` |
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
| POST | /championships/:id/stages/:stageId/advance | JWT | — | `{ message }` reintenta el avance automático de la etapa (siguiente ronda, cierre de etapa/campeonato); idempotente |
| GET | /championships/:id/table-positions | JWT | `?stageId=` (opcional; si no: etapa en juego → generada → última finalizada) | `[{ team, name, logo, group?, played, wins, draws, losses, goalsFor, goalsAgainst, goalDifference, points, position }]`; en grupos viene ordenada por grupo y `position` es dentro del grupo; knockout → 400 |
| POST | /matchs/:id/start | JWT | — | La vocalía (MatchReport) creada |
| DELETE | /matchs/:id/revert-start | JWT | — | `{ success: true, data: match }` |
| PUT | /matchs/:id/penalties | JWT admin/directivo | `{ localPenalties, visitorPenalties }` (enteros ≥ 0, distintos) | partido + `warning?` si los penales se guardaron pero la etapa aún no puede avanzar |
| PUT | /matchs-reports/:id | JWT | campos parciales de la vocalía | vocalía actualizada |
| POST | /matchs-reports/:id/finalizar | JWT | `{ status: "finalizado" \| "suspendido", localPenalties?, visitorPenalties? }` (penales obligatorios si es knockout empatado) | `"Vocalia finalizada"` |

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
| /campeonatos, /campeonatos/insert, /campeonatos/[id]/edit | Campeonatos, categoría, equipos inscritos y podio (campeón, subcampeón, tercero) | /championships, /categories, /teams |
| /campeonatos/[id]/gestionar | Etapas, generar/borrar fixture, jornadas, programar partidos (fecha, vocal, árbitros), iniciar/revertir partido, tabla de posiciones (una por grupo; sin tabla en knockout), etiquetas Grupo / Tercer lugar / penales / "Empate sin penales", podio del campeonato finalizado | /championships/:id, /championships/:id/stages, generate-fixture, delete-fixture, /rounds, /matchs, PUT /matchs/:id, /matchs/:id/start, revert-start, /users (oficiales), table-positions |
| /campeonatos/[id]/vocalia/[vocaliaId] | Vocalía en vivo: cronómetro, eventos, alineaciones, capitanes, informes, recaudación, finalizar (modal de penales si es knockout empatado). Cerrada: registrar/corregir penales (admin/directivo) | /matchs-reports/:id (GET/PUT), /matchs-reports/:id/finalizar, /matchs/:id, /matchs/:id/penalties, /championships/:id/stages, /matchs-events (CRUD), /players |
| /matchs | "Mis partidos" del oficial (filtra `vocal = usuario`) e inicio de vocalía | GET /matchs, /matchs/:id/start, revert-start |
| /history | Historial de partidos finalizados/suspendidos como árbitro, asistente o vocal, por rango de fechas | GET /matchs |
| /usuarios | Usuarios de la liga (admin) | /users |

**Enlaces de menú sin página todavía:** `/referees`, `/vocals`, `/statistics` (directivo y player), `/team` (player).

## 7. Requisitos no funcionales
- Responsive: layout con `Drawer` en móvil (antd `useBreakpoint`, corte en `lg`)
- Node ≥ 20 para la app (Next 16) y la API (Fastify 5)
- Entornos de la app: `npm run dev` usa `.env.development` (API local `http://localhost:5001` → base local);
  `npm run build`/`start` usa `.env.production` (API de producción). `.env` solo lleva variables comunes.
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
- 2026-11-12 — Competiciones: knockout ronda por ronda con avance automático al cerrar la última vocalía;
  empates knockout por penales; grupos con composición guardada en la etapa; cierre automático del campeonato.
- 2026-11-12 — Penales de partidos cerrados se corrigen solo por `PUT /matchs/:id/penalties` (admin/directivo).
- 2026-11-12 — La app separa entornos con `.env.development` / `.env.production` (versionados, sin secretos);
  axios llama directo a `NEXT_PUBLIC_API_URL` (por eso la API habilita CORS para PUT/DELETE).
- 2026-11-12 — El token de `/auth/admin/login` no lleva `league`: el master solo crea ligas y usuarios.
- Pendiente: ¿Zod (ya instalado) o JSON Schema de Fastify para validar endpoints nuevos?

## 10. Pendientes
Cada punto debería convertirse en su propia spec antes de arreglarse. Los números son fijos.

**App ↔ API**
- **13.** La app llama `GET /dashboard/admin/statics` (`app/(admin)/home/page.tsx`), que no existe en la API.
- **14.** El layout `(admin)` redirige si `!isAdmin`, e `isAdmin` solo es true con el rol `admin`: un usuario solo `master` sería expulsado de `/users`. [VERIFICAR]
- **15.** El menú tiene rutas sin página (`/referees`, `/vocals`, `/statistics`, `/team`).
- **17.** Duplicados en la app: `assets/filtros.tsx` ≈ `assets/utils.tsx`; `Movement` en `types/global.ts` y `types/utils.ts`.
