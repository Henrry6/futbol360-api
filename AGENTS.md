# AGENTS.md — futbol360-api

Instrucciones para agentes de IA (Claude Code, Codex, Cursor, etc.) que trabajen en este repo.

**Contexto único del proyecto Fútbol 360:**
- `SPEC.md` (este repo) es la fuente de verdad del producto y del contrato API ↔ app.
- `specs/NNN-*.md` (este repo) son las specs de cada funcionalidad, para API y app.
- El frontend vive en el repo hermano `../futbol360-app` y lee estos mismos archivos.
  No dupliques SPEC.md en la app: se edita solo aquí.

Lee `SPEC.md` y la spec de la tarea antes de escribir código.

## Stack (versiones reales de package.json)
- Node + TypeScript (`strict`), módulos CommonJS, target ES2022
- Fastify 5 (+ @fastify/cors, @fastify/jwt, @fastify/multipart, @fastify/swagger, @fastify/swagger-ui)
- MongoDB con Mongoose 8 + `mongoose-smart-query` 1.4 (tipos extendidos en `global.d.ts`)
- Imágenes en Cloudinary, correos con Nodemailer (SMTP puerto 587), contraseñas con bcryptjs
- Logs de depuración con `debug` (namespace `src:*`, habilitado en `app.ts`)
- Zod 4 está instalado pero **todavía no se usa** en ningún archivo
- Alias de imports: `@/*` → `src/*` (resuelto en build con `tsc-alias`)

## Comandos
- `npm run dev` — servidor con recarga (`tsx watch src/server.ts`). Puerto = `PORT` del `.env` (la app espera 5001)
- `npm run build` — compila a `dist/` (`tsc && tsc-alias`)
- `npm start` — ejecuta `dist/server.js`
- `npx tsc --noEmit` — chequeo de tipos rápido
- No hay tests ni linter configurados.
- Antes de dar una tarea por terminada: `npm run build` debe pasar sin errores.
- Swagger UI en `/docs`. Health check en `GET /health` (estado de Mongo y uptime).

## Arranque (`src/server.ts`)
1. `connectDatabase()` → `MONGO_URI` (por defecto `mongodb://localhost:27017/futbol360`)
2. `seedMaster()` → crea el usuario `master` (`admin@futbol360.com`) si no existe
3. `buildApp()` (`src/app.ts`) → cors, swagger, multipart, auth, jwt, mailer, error handler, rutas

Las transacciones (`session.withTransaction`, fixture) requieren que Mongo corra como **replica set**.

## Estructura real
```
global.d.ts                 # extiende mongoose.Model con smartQuery/smartCount/getOptions
src/
  server.ts                 # bootstrap: DB → seed → app.listen(0.0.0.0)
  app.ts                    # Fastify, plugins y setErrorHandler global
  seed.ts                   # usuario master inicial
  config/                   # env.ts (PORT, MONGO_URI), database.ts
  plugins/                  # auth (authenticate + authorize), jwt, cors, swagger, upload (multipart 5MB), emails (mailer)
  routes/index.ts           # registro de TODOS los módulos y sus prefijos
  types/fastify.d.ts        # JwtUser y request.payload
  models/                   # SOLO esquemas Mongoose + interfaces TS (sin model())
    users.ts leagues.ts categories.ts teams.ts players.ts rounds.ts champions.ts
    matchs/match.ts matchs/matchReport.ts matchs/matchEvent.ts
  modules/<dominio>/
    *.service.ts            # registra el plugin smartQuery, hooks, statics/methods y exporta model()
    *.controller.ts         # handlers personalizados (lógica de negocio)
    *.routes.ts             # registra UpRouter (CRUD) + rutas extra
  modules/championships/competicion/   # generación de fixture y tabla de posiciones
  libs/
    UpRouter.ts             # CRUD genérico (GET, GET/:id, POST, PUT/:id, DELETE/:id, GET/get-options)
    utils.ts                # FastifyError, hashPassword, getMovimiento, Movement, deepmerge, sendMail, uniqueDocValidator
    useful.ts               # enum Collections (nombres de colecciones)
    cloudinary.ts           # uploadImage / deleteImage / buildImageUrl
    imageController.ts      # handlers POST/GET/DELETE /:id/image reutilizables
    templates-emails.ts     # plantillas HTML de correo
```
Nota: en este proyecto `*.service.ts` **es el modelo Mongoose** (no una capa de servicio separada).
Mantén ese patrón; no crees `*.model.ts` ni `*.schema.ts` nuevos sin acordarlo.

## Cómo añadir un recurso nuevo (patrón del repo)
1. Esquema e interfaz en `src/models/<nombre>.ts` con `league` (ref LEAGUES, required) y `_movements: [Movement]`.
2. Nombre de colección en `Collections` (`src/libs/useful.ts`).
3. `src/modules/<nombre>/<nombre>.service.ts`: `Schema.plugin(mongooseSmartQuery, { defaultFields, fieldsForDefaultQuery, ...msqTemporalOptions })` y `export default model(...)`.
4. `src/modules/<nombre>/<nombre>.routes.ts`: `app.register(UpRouter, { Model })` + rutas extra con su controller.
5. Registrar el módulo en `src/routes/index.ts` dentro del bloque autenticado.
6. Documentar endpoints en `SPEC.md` §5.

## Convenciones
- **Multi-liga (multi-tenant):** casi todo documento tiene `league`. `UpRouter.prepareRequest` inyecta
  `league` desde el JWT en filtros GET y en el body de POST/PUT. En controllers propios filtra SIEMPRE
  por `{ _id, league: req.payload.league }`. Nunca confíes en `league`, `user` o `createdBy` del body.
- **Auditoría:** cada documento lleva `_movements` (`{ type, date, user, nota }`). Usa
  `getMovimiento({ type, user })` al crear, editar, iniciar, revertir, finalizar, etc.
- **Errores:** lanza `new FastifyError(mensaje, statusCode)` (por defecto 400). El handler global
  responde `{ success: false, message, code }`. No lances `Error` genérico (termina en 500).
- **Listados:** `UpRouter` responde `{ page, total, data }`. Query params: `page`, `limit`, `fields`,
  `sort`, `q` (búsqueda en `fieldsForDefaultQuery`) y cualquier campo del esquema como filtro.
  `defaultFields` admite poblar con `campo { sub1 sub2 }`.
- **Edición:** PUT hace deep-merge (`deepmerge`, sin mezclar arrays) del body sobre el documento.
- **Roles:** `authorize([...roles])` de `src/plugins/auth.ts` como `preHandler`.
- **Imágenes:** guardar el `publicId` de Cloudinary en el campo (`logo`, `photo`) y devolver la URL con `buildImageUrl`. Carpeta `futbol360/<recurso>`.
- Nombres de código y campos en inglés (hay legado en español: `fundacion`, `directorio`, `_movements.nota`,
  variables `Partidos`, `Vocalias`…). Mensajes al usuario en español.
- Estados (`status`) en español y snake_case: `activo`, `en_juego`, `finalizado`… (ver SPEC.md §3).
- No añadir dependencias nuevas sin justificarlo en el PR.

## Seguridad
- Secretos solo en `.env` (ignorado por git). Variables documentadas en `.env.example`.
  Nunca escribirlos en código, logs, tests ni en este archivo.
- Si añades una variable de entorno, añádela a `.env.example` con valor ficticio.
- El campo `password` NO tiene `select: false`: nunca devuelvas el documento de usuario completo;
  usa proyecciones o borra `password` antes de responder.
- Subidas: multipart limitado a 5 MB; valida tipo (jpg/png/webp) antes de enviar a Cloudinary.
- El error handler imprime body/params/query en consola: no registres contraseñas a propósito.

## Contrato con el frontend
- `futbol360-app` (Next.js) llama a `/api/*`, que `next.config.ts` reescribe a
  `NEXT_PUBLIC_API_URL` o `http://localhost:5001`. Por eso las rutas aquí NO llevan prefijo `/api`.
- Si cambias la forma de una respuesta o un endpoint, actualiza `SPEC.md` §5 y avisa en el PR:
  rompe el frontend.

## Deuda técnica conocida
Ver `SPEC.md` §10. No la corrijas "de paso": cada arreglo va en su propia tarea/spec.

## Flujo de trabajo para el agente
1. Lee la spec de la tarea en `specs/NNN-*.md`. Si no existe o es ambigua, pregunta.
2. Propón un plan corto (archivos a tocar) antes de editar.
3. Implementa en pasos pequeños; compila tras cada paso (`npx tsc --noEmit`).
4. Al terminar: `npm run build`, actualiza `SPEC.md` si cambió el contrato y marca los
   criterios de aceptación cumplidos en la spec.
