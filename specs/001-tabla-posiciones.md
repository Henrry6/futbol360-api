# 001 — Tabla de posiciones de un campeonato

**Estado:** API hecha · app por verificar
**Repos afectados:** ambos

> Spec de referencia: documenta una funcionalidad que ya existe en la API,
> para que sirva de ejemplo del formato y de contrato para la app.

## Objetivo
Que los usuarios de una liga vean la tabla de posiciones de una etapa de un campeonato.

## Comportamiento esperado
- La tabla se calcula en cada petición a partir de los partidos de la etapa en estado
  `en_juego`, `finalizado` o `suspendido` (no se guarda).
- Participantes: en la etapa 1, los equipos `activo` del campeonato; en etapas siguientes,
  los clasificados de la etapa anterior.
- Puntos: victoria 3, empate 1, derrota 0.
- Orden: puntos → diferencia de goles → goles a favor → partidos ganados → id del equipo.
- Sin `stageId`, usa la primera etapa en `en_juego` o `finalizada`.
- Etapa `knockout` → error "La etapa no tiene tabla de posiciones."

## Cambios en la API
| Método | Ruta | Auth | Body / Query | Respuesta |
|---|---|---|---|---|
| GET | /championships/:id/table-positions | JWT | `?stageId=` opcional | `[{ team, name, logo, played, wins, draws, losses, goalsFor, goalsAgainst, goalDifference, points, position }]` |

Código: `src/modules/championships/championship.controller.ts` (`tablePositions`),
`competicion/standings.ts`, `competicion/rankings.ts`.

## Cambios en la app
- Pantalla de tabla dentro del detalle del campeonato, con selector de etapa
  (`GET /championships/:id/stages`, excluir `knockout`).
- `logo` es un publicId de Cloudinary: mostrar con `next/image`.

## Criterios de aceptación
- [x] Etapa sin partidos jugados → todos los equipos con 0
- [x] Orden correcto en empate a puntos
- [ ] Campeonato inexistente o de otra liga → hoy responde 400 "No se encontró el campeonato." (¿debería ser 404?)
- [ ] La app muestra estados de carga, vacío y error
- [ ] `npm run build` pasa en ambos repos

## Preguntas abiertas
- ¿Debe existir una versión pública (sin JWT) de la tabla para visitantes?
- ¿Se agregarán desempates por enfrentamiento directo o fair play?
