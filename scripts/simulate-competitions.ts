/**
 * Simulador de competiciones — Fútbol 360
 *
 * Recorre de punta a punta, por HTTP (app.inject, sin abrir puertos), el mismo
 * flujo que usa la app: crear equipos y campeonato → etapas → generar fixture →
 * iniciar cada partido → registrar goles → finalizar vocalía (con penales si es
 * knockout y hay empate) → tabla de posiciones → campeón.
 *
 * En cada escenario verifica invariantes (todos contra todos exactos, nadie
 * juega dos veces por jornada, puntos y goles cuadran, la llave avanza bien,
 * los clasificados pasan a la etapa siguiente…) y prueba errores esperados.
 *
 * Uso:   npm run simulate                 (semilla 360)
 *        npm run simulate -- --seed 7     (otros resultados aleatorios)
 *        npm run simulate -- --quiet      (solo resumen y verificaciones)
 *
 * Usa SIEMPRE una base temporal que se borra al inicio y al final:
 *   SIM_MONGO_URI (por defecto mongodb://localhost:27017/futbol360_simulacion)
 * Requiere MongoDB en replica set (las etapas se generan en transacción).
 */
import Debug from "debug";
import mongoose from "mongoose";
import type { FastifyInstance } from "fastify";

process.env.JWT_SECRET ||= "simulacion";

import { buildApp } from "@/app";
import Users from "@/modules/users/users.service";
import Leagues from "@/modules/leagues/leagues.service";

// ───────────────────────── configuración ─────────────────────────
const args = process.argv.slice(2);
const SEED = Number(args[args.indexOf("--seed") + 1]) || 360;
const QUIET = args.includes("--quiet");
const URI =
  process.env.SIM_MONGO_URI ??
  "mongodb://localhost:27017/futbol360_simulacion";

if (!/simulacion/i.test(URI)) {
  console.error("Por seguridad SIM_MONGO_URI debe apuntar a una base cuyo nombre contenga 'simulacion'.");
  process.exit(1);
}

// Aleatorio reproducible (también para los sorteos de la API)
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = mulberry32(SEED);
const randInt = (max: number) => Math.floor(Math.random() * (max + 1));
const goals = () => [0, 0, 1, 1, 1, 2, 2, 3, 4][randInt(8)];

// ───────────────────────── utilidades ─────────────────────────
let app: FastifyInstance;
let token = "";
let categoryId = "";
const teamNames = new Map<string, string>();
const failures: string[] = [];
let checks = 0;

// La API escribe logs propios (debug "src:*", error handler, console.log):
// se silencian y el simulador escribe directo en stdout.
const out = (...m: unknown[]) => process.stdout.write(m.join(" ") + "\n");
console.log = console.error = console.warn = () => undefined;
const log = (...m: unknown[]) => !QUIET && out(...m);
const name = (id: unknown) => teamNames.get(String(id)) ?? String(id);

function check(condition: unknown, message: string) {
  checks++;
  if (!condition) {
    failures.push(message);
    out(`   ✗ ${message}`);
  }
}

async function call<T = any>(method: "GET" | "POST" | "PUT" | "DELETE", url: string, body?: object) {
  const res = await app.inject({
    method,
    url,
    payload: body as any,
    headers: { authorization: `Bearer ${token}` },
  });
  const data = res.body ? safeJson(res.body) : undefined;
  if (res.statusCode >= 400) {
    const err = new Error(`${method} ${url} → ${res.statusCode}: ${data?.message ?? res.body}`);
    (err as any).statusCode = res.statusCode;
    (err as any).apiMessage = data?.message;
    throw err;
  }
  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Ejecuta una llamada que DEBE fallar y verifica el mensaje. */
async function expectError(label: string, fn: () => Promise<unknown>, includes: string) {
  try {
    await fn();
    check(false, `${label}: se esperaba un error y la API respondió OK`);
  } catch (e: any) {
    const ok = String(e.apiMessage ?? e.message).includes(includes);
    check(ok, `${label}: mensaje inesperado → ${e.apiMessage ?? e.message}`);
    if (ok) log(`   ✓ error esperado — ${label}: "${e.apiMessage}"`);
  }
}

const pairKey = (a: unknown, b: unknown) => [String(a), String(b)].sort().join("|");

// ───────────────────────── tipos de escenario ─────────────────────────
interface StageDef {
  name: string;
  mode: "round_robin" | "round_robin_double" | "groups" | "knockout";
  participants: number;
  qualifyTeams?: number;
  groups?: number;
  thirdPlaceMatch?: boolean;
}
interface Scenario {
  title: string;
  teams: number;
  stages: StageDef[];
}

interface PlayedMatch {
  status?: string;
  _id: string;
  localTeam: string;
  visitorTeam: string;
  localGoals: number;
  visitorGoals: number;
  localPenalties?: number;
  visitorPenalties?: number;
  group?: string;
  bracketPosition?: number;
  isThirdPlaceMatch?: boolean;
}
interface PlayedRound {
  _id: string;
  round: number;
  name: string;
  matches: PlayedMatch[];
}

// ───────────────────────── preparación ─────────────────────────
async function setup() {
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  const league = await Leagues.create({ code: "SIM", name: "Liga Simulación" });
  const user = await Users.create({
    name: "Simulador",
    username: "simulador",
    email: "simulador@example.com",
    password: "x",
    roles: ["admin", "directivo", "official"],
    leagues: [league._id],
  });

  app = await buildApp();
  Debug.disable();
  token = app.jwt.sign({
    user: user._id,
    username: user.username,
    roles: user.roles,
    league: league._id,
  });

  const category = await call("POST", "/categories", { name: "Sub-40" });
  categoryId = category._id;
}

let teamCounter = 0;
async function createTeams(count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    teamCounter++;
    const teamName = `Club ${String(teamCounter).padStart(2, "0")}`;
    const team = await call("POST", "/teams", { name: teamName, representative: "Simulación" });
    teamNames.set(team._id, teamName);
    ids.push(team._id);
  }
  return ids;
}

// ───────────────────────── juego ─────────────────────────
async function getRounds(championshipId: string, stageId: string) {
  const { data } = await call(
    "GET",
    `/rounds?championship=${championshipId}&stage=${stageId}&sort=round&limit=200`,
  );
  return data as { _id: string; round: number; name: string; status: string }[];
}

async function getMatches(roundId: string): Promise<PlayedMatch[]> {
  const { data } = await call("GET", `/matchs?round=${roundId}&limit=200&$getAllFields=true`);
  const id = (v: any) => String(v?._id ?? v);
  return data.map((m: any) => ({ ...m, localTeam: id(m.localTeam), visitorTeam: id(m.visitorTeam) }));
}

/** Juega una jornada completa como lo haría el vocal en la app. */
async function playRound(championshipId: string, stage: StageDef & { _id: string }, roundId: string) {
  const matches = await getMatches(roundId);
  for (const match of matches) {
    if (match.status !== "programado") continue;
    const vocalia = await call("POST", `/matchs/${match._id}/start`);
    const lg = goals();
    const vg = goals();
    const scorers = [
      ...Array(lg).fill(match.localTeam),
      ...Array(vg).fill(match.visitorTeam),
    ];
    for (const team of scorers) {
      await call("POST", "/matchs-events", {
        vocalia: vocalia._id,
        match: match._id,
        championship: championshipId,
        stage: stage._id,
        round: roundId,
        team,
        minute: 1 + randInt(89),
        type: "gol",
      });
    }
    const body: Record<string, unknown> = { status: "finalizado" };
    if (stage.mode === "knockout" && lg === vg) {
      // Primero comprobamos que sin penales la API no deja cerrar el empate
      await expectError(
        "finalizar empate knockout sin penales",
        () => call("POST", `/matchs-reports/${vocalia._id}/finalizar`, body),
        "penales",
      );
      const lp = 3 + randInt(2);
      body.localPenalties = lp;
      body.visitorPenalties = randInt(1) ? lp + 1 : lp - 1;
    }
    await call("POST", `/matchs-reports/${vocalia._id}/finalizar`, body);
  }
}

/** Juega toda una etapa y devuelve sus jornadas con resultados. */
async function playStage(championshipId: string, stage: StageDef & { _id: string }) {
  for (let guard = 0; guard < 200; guard++) {
    const rounds = await getRounds(championshipId, stage._id);
    const pending = rounds.find((r) => r.status !== "finalizado");
    if (!pending) break;
    await playRound(championshipId, stage, pending._id);
  }
  const rounds = await getRounds(championshipId, stage._id);
  const played: PlayedRound[] = [];
  for (const r of rounds) {
    played.push({ _id: r._id, round: r.round, name: r.name, matches: await getMatches(r._id) });
  }
  return played;
}

// ───────────────────────── impresión ─────────────────────────
function score(m: PlayedMatch) {
  const pens =
    m.localPenalties !== undefined && m.localPenalties !== null
      ? ` (pen ${m.localPenalties}-${m.visitorPenalties})`
      : "";
  return `${name(m.localTeam).padEnd(8)} ${m.localGoals}-${m.visitorGoals} ${name(m.visitorTeam)}${pens}`;
}

function printRounds(rounds: PlayedRound[]) {
  for (const r of rounds) {
    log(`   ${r.name}`);
    const sorted = [...r.matches].sort(
      (a, b) =>
        (a.group ?? "").localeCompare(b.group ?? "") ||
        (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0),
    );
    for (const m of sorted) {
      const tag = m.group ? `[${m.group}] ` : m.isThirdPlaceMatch ? "[3er] " : m.bracketPosition ? `[${m.bracketPosition}] ` : "";
      log(`      ${tag}${score(m)}`);
    }
  }
}

function printTable(table: any[]) {
  log("   Pos Equipo    PJ  G  E  P  GF GC  DG  PTS");
  let group: string | undefined;
  for (const row of table) {
    if (row.group !== group) {
      group = row.group;
      if (group) log(`   — Grupo ${group}`);
    }
    log(
      `   ${String(row.position).padStart(2)}  ${row.name.padEnd(8)} ${[row.played, row.wins, row.draws, row.losses, row.goalsFor, row.goalsAgainst]
        .map((v: number) => String(v).padStart(2))
        .join(" ")} ${String(row.goalDifference).padStart(3)}  ${String(row.points).padStart(3)}`,
    );
  }
}

// ───────────────────────── verificaciones ─────────────────────────
function checkRoundRobin(stage: StageDef, rounds: PlayedRound[], teams: string[], legs: number, groupOf?: Map<string, string>) {
  const meetings = new Map<string, number>();
  const homes = new Map<string, number>();
  for (const r of rounds) {
    const inRound = new Set<string>();
    for (const m of r.matches) {
      for (const t of [m.localTeam, m.visitorTeam]) {
        check(!inRound.has(t), `${stage.name} ${r.name}: ${name(t)} juega dos veces`);
        inRound.add(t);
      }
      if (groupOf) {
        check(
          groupOf.get(m.localTeam) === groupOf.get(m.visitorTeam) && groupOf.get(m.localTeam) === m.group,
          `${stage.name}: ${score(m)} cruza grupos`,
        );
      }
      const k = pairKey(m.localTeam, m.visitorTeam);
      meetings.set(k, (meetings.get(k) ?? 0) + 1);
      homes.set(m.localTeam, (homes.get(m.localTeam) ?? 0) + 1);
    }
  }
  // Cada par (del mismo grupo) se enfrenta exactamente `legs` veces
  const buckets = groupOf
    ? [...new Set(groupOf.values())].map((g) => teams.filter((t) => groupOf.get(t) === g))
    : [teams];
  let expectedMatches = 0;
  for (const bucket of buckets) {
    for (let i = 0; i < bucket.length; i++)
      for (let j = i + 1; j < bucket.length; j++) {
        expectedMatches += legs;
        check(
          meetings.get(pairKey(bucket[i], bucket[j])) === legs,
          `${stage.name}: ${name(bucket[i])} vs ${name(bucket[j])} se enfrentan ${meetings.get(pairKey(bucket[i], bucket[j])) ?? 0} veces (esperado ${legs})`,
        );
      }
  }
  const total = rounds.reduce((n, r) => n + r.matches.length, 0);
  check(total === expectedMatches, `${stage.name}: ${total} partidos (esperado ${expectedMatches})`);
  const biggest = Math.max(...buckets.map((b) => b.length));
  const expectedRounds = legs * (biggest % 2 === 0 ? biggest - 1 : biggest);
  check(rounds.length === expectedRounds, `${stage.name}: ${rounds.length} jornadas (esperado ${expectedRounds})`);
  const h = [...teams].map((t) => homes.get(t) ?? 0);
  log(`   Localías por equipo: mín ${Math.min(...h)} / máx ${Math.max(...h)}`);
}

function checkTable(stage: StageDef, table: any[], rounds: PlayedRound[]) {
  const matches = rounds.flatMap((r) => r.matches);
  const played = table.reduce((n, r) => n + r.played, 0);
  check(played === matches.length * 2, `${stage.name}: suma PJ ${played} ≠ ${matches.length * 2}`);
  const gf = table.reduce((n, r) => n + r.goalsFor, 0);
  const ga = table.reduce((n, r) => n + r.goalsAgainst, 0);
  const goalsTotal = matches.reduce((n, m) => n + m.localGoals + m.visitorGoals, 0);
  check(gf === goalsTotal && ga === goalsTotal, `${stage.name}: GF/GC no cuadran con los partidos`);
  const draws = matches.filter((m) => m.localGoals === m.visitorGoals).length;
  const points = table.reduce((n, r) => n + r.points, 0);
  check(points === (matches.length - draws) * 3 + draws * 2, `${stage.name}: suma de puntos incorrecta`);
  for (const row of table) {
    check(row.points === row.wins * 3 + row.draws, `${stage.name}: ${row.name} puntos ≠ 3G+E`);
    check(row.played === row.wins + row.draws + row.losses, `${stage.name}: ${row.name} PJ ≠ G+E+P`);
  }
  // Orden y posiciones (por grupo si aplica)
  const groups = new Map<string, any[]>();
  for (const row of table) groups.set(row.group ?? "", [...(groups.get(row.group ?? "") ?? []), row]);
  for (const rows of groups.values()) {
    rows.forEach((row, i) => check(row.position === i + 1, `${stage.name}: posición ${row.position} en lugar ${i + 1}`));
    for (let i = 1; i < rows.length; i++) {
      const [a, b] = [rows[i - 1], rows[i]];
      const ordered =
        a.points > b.points ||
        (a.points === b.points && (a.goalDifference > b.goalDifference ||
          (a.goalDifference === b.goalDifference && (a.goalsFor > b.goalsFor ||
            (a.goalsFor === b.goalsFor && a.wins >= b.wins)))));
      check(ordered, `${stage.name}: ${a.name} y ${b.name} mal ordenados`);
    }
  }
}

function knockoutWinner(m: PlayedMatch) {
  if (m.localGoals !== m.visitorGoals) return m.localGoals > m.visitorGoals ? m.localTeam : m.visitorTeam;
  return (m.localPenalties ?? 0) > (m.visitorPenalties ?? 0) ? m.localTeam : m.visitorTeam;
}
function knockoutLoser(m: PlayedMatch) {
  return knockoutWinner(m) === m.localTeam ? m.visitorTeam : m.localTeam;
}

function checkKnockout(stage: StageDef, rounds: PlayedRound[], teams: string[]) {
  const target = stage.qualifyTeams || 1;
  let alive = new Set(teams);
  for (const [i, r] of rounds.entries()) {
    const bracket = r.matches
      .filter((m) => !m.isThirdPlaceMatch)
      .sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0));
    check(bracket.length * 2 === alive.size, `${stage.name} ${r.name}: ${bracket.length} cruces para ${alive.size} equipos`);
    for (const m of bracket) {
      check(alive.has(m.localTeam) && alive.has(m.visitorTeam), `${stage.name} ${r.name}: ${score(m)} incluye un eliminado`);
    }
    if (i > 0) {
      // Continuidad de la llave: ganador cruce 2k-1 vs ganador 2k de la ronda anterior
      const prev = rounds[i - 1].matches.filter((m) => !m.isThirdPlaceMatch).sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0));
      bracket.forEach((m, k) => {
        check(
          m.localTeam === knockoutWinner(prev[2 * k]) && m.visitorTeam === knockoutWinner(prev[2 * k + 1]),
          `${stage.name} ${r.name}: el cruce ${k + 1} no sale de los ganadores ${2 * k + 1} y ${2 * k + 2}`,
        );
      });
    }
    const third = r.matches.filter((m) => m.isThirdPlaceMatch);
    if (bracket.length === 1 && stage.thirdPlaceMatch) {
      check(third.length === 1, `${stage.name}: falta el partido por el tercer lugar`);
      const semis = rounds[i - 1]?.matches ?? [];
      const losers = new Set(semis.map(knockoutLoser));
      check(third[0] && losers.has(third[0].localTeam) && losers.has(third[0].visitorTeam), `${stage.name}: el 3er lugar no es entre perdedores de semifinal`);
    } else {
      check(third.length === 0, `${stage.name} ${r.name}: partido de 3er lugar inesperado`);
    }
    alive = new Set(bracket.map(knockoutWinner));
  }
  check(alive.size === target, `${stage.name}: terminan ${alive.size} equipos (esperado ${target})`);
  return [...alive];
}

// ───────────────────────── escenario ─────────────────────────
async function runScenario(scenario: Scenario) {
  out(`\n═══ ${scenario.title} ═══`);
  const failuresBefore = failures.length;
  const teams = await createTeams(scenario.teams);
  const championship = await call("POST", "/championships", {
    name: scenario.title,
    category: categoryId,
    season: new Date().toISOString(),
    type: "temporada",
    teams: teams.map((team) => ({ team })),
  });
  const id = championship._id;
  for (const stage of scenario.stages) {
    await call("POST", `/championships/${id}/stages`, stage);
  }
  const stages: (StageDef & { _id: string; order: number })[] = await call("GET", `/championships/${id}/stages`);
  stages.sort((a, b) => a.order - b.order);

  let stageTeams = teams;
  let previousQualified: string[] | undefined;

  for (const [index, stage] of stages.entries()) {
    log(`\n ▸ Etapa ${stage.order}: ${stage.name} (${stage.mode}, ${stage.participants} equipos${stage.qualifyTeams ? `, clasifican ${stage.qualifyTeams}` : ""}${stage.groups ? `, ${stage.groups} grupos` : ""}${stage.thirdPlaceMatch ? ", con 3er lugar" : ""})`);

    // La siguiente etapa no se puede generar antes de terminar esta
    const next = stages[index + 1];
    if (next) {
      await expectError("generar etapa siguiente antes de tiempo", () => call("POST", `/championships/${id}/generate-fixture/${next._id}`), "aún no ha finalizado");
    }

    await call("POST", `/championships/${id}/generate-fixture/${stage._id}`);
    await expectError("generar dos veces", () => call("POST", `/championships/${id}/generate-fixture/${stage._id}`), "ya fue generada");

    // Equipos de la etapa
    const generated = (await call("GET", `/championships/${id}`)).stages.find((s: any) => s._id === stage._id);
    if (index > 0) {
      const firstRound = (await getRounds(id, stage._id))[0];
      const firstMatches = await getMatches(firstRound._id);
      const inStage = stage.mode === "groups"
        ? generated.groupsTeams.flatMap((g: any) => g.teams)
        : stage.mode === "knockout"
          ? firstMatches.flatMap((m) => [m.localTeam, m.visitorTeam])
          : null;
      if (inStage) {
        check(
          inStage.length === previousQualified!.length && previousQualified!.every((t) => inStage.includes(t)),
          `${stage.name}: los equipos no coinciden con los clasificados de la etapa anterior`,
        );
        stageTeams = inStage;
      } else {
        stageTeams = previousQualified!;
      }
    }

    const groupOf = stage.mode === "groups"
      ? new Map<string, string>(generated.groupsTeams.flatMap((g: any) => g.teams.map((t: string) => [t, g.name])))
      : undefined;
    if (groupOf) {
      log(`   Sorteo: ${generated.groupsTeams.map((g: any) => `${g.name}=[${g.teams.map(name).join(", ")}]`).join("  ")}`);
    }

    const rounds = await playStage(id, stage);
    printRounds(rounds);

    const after = (await call("GET", `/championships/${id}`)).stages.find((s: any) => s._id === stage._id);
    check(after.status === "finalizada", `${stage.name}: estado final "${after.status}" (esperado "finalizada")`);

    if (stage.mode === "knockout") {
      await expectError("tabla de una etapa knockout", () => call("GET", `/championships/${id}/table-positions?stageId=${stage._id}`), "no tiene tabla");
      previousQualified = checkKnockout(stage, rounds, stageTeams);
      if (stage.qualifyTeams) log(`   Clasificados: ${previousQualified.map(name).join(", ")}`);
    } else {
      const legs = stage.mode === "round_robin_double" ? 2 : 1;
      checkRoundRobin(stage, rounds, stageTeams, legs, groupOf);
      const table = await call<any[]>("GET", `/championships/${id}/table-positions?stageId=${stage._id}`);
      log("");
      printTable(table);
      checkTable(stage, table, rounds);
      if (stage.qualifyTeams) {
        const perGroup = stage.groups ? stage.qualifyTeams / stage.groups : stage.qualifyTeams;
        previousQualified = table.filter((r) => r.position <= perGroup).map((r) => String(r.team));
        log(`   Clasificados: ${previousQualified.map(name).join(", ")}`);
      }
    }
  }

  // Cierre del campeonato
  const final = await call("GET", `/championships/${id}`);
  const lastStage = stages.at(-1)!;
  log(`\n 🏆 Campeón: ${final.champion ? name(final.champion) : "—"} · Subcampeón: ${final.runnerUp ? name(final.runnerUp) : "—"} · Tercero: ${final.thirdPlace ? name(final.thirdPlace) : "—"}`);
  check(final.status === "finalizado", `Campeonato en estado "${final.status}" (esperado "finalizado")`);
  if (lastStage.mode !== "groups") {
    check(final.champion && final.runnerUp, "El campeonato no asignó campeón y subcampeón");
  }
  if (lastStage.mode === "knockout" && lastStage.thirdPlaceMatch) {
    check(final.thirdPlace, "No se asignó el tercer lugar");
  }
  const ok = failures.length === failuresBefore;
  out(` ${ok ? "✓" : "✗"} ${scenario.title}: ${ok ? "todas las verificaciones OK" : `${failures.length - failuresBefore} fallas`}`);
}

// ───────────────────────── validaciones de configuración ─────────────────────────
async function runValidationScenario() {
  out("\n═══ Validaciones de configuración ═══");
  const teams = await createTeams(6);
  const create = async (stage: StageDef, teamIds = teams) => {
    const c = await call("POST", "/championships", {
      name: `Validación ${stage.mode}`,
      category: categoryId,
      season: new Date().toISOString(),
      teams: teamIds.map((team) => ({ team })),
    });
    await call("POST", `/championships/${c._id}/stages`, stage);
    const [s] = await call("GET", `/championships/${c._id}/stages`);
    return () => call("POST", `/championships/${c._id}/generate-fixture/${s._id}`);
  };
  await expectError("knockout con 6 equipos", await create({ name: "KO", mode: "knockout", participants: 6 }), "2, 4, 8, 16");
  await expectError("participants distinto a inscritos", await create({ name: "Liga", mode: "round_robin", participants: 8 }), "requiere 8 equipos");
  await expectError("clasificados ≥ participantes", await create({ name: "Liga", mode: "round_robin", participants: 6, qualifyTeams: 6 }), "menos que los participantes");
  await expectError("grupos con clasificados no divisibles", await create({ name: "Grupos", mode: "groups", participants: 6, groups: 2, qualifyTeams: 3 }), "partes iguales");
  await expectError("grupos de 1 equipo", await create({ name: "Grupos", mode: "groups", participants: 6, groups: 4 }), "al menos 2 equipos");
  await expectError("knockout con 3er lugar y clasificados", await create({ name: "KO", mode: "knockout", participants: 4, qualifyTeams: 2, thirdPlaceMatch: true }, teams.slice(0, 4)), "tercer lugar");

  // Eliminar y regenerar fixture de una fase de grupos
  const c = await call("POST", "/championships", {
    name: "Validación fixture",
    category: categoryId,
    season: new Date().toISOString(),
    teams: teams.map((team) => ({ team })),
  });
  await call("POST", `/championships/${c._id}/stages`, { name: "Grupos", mode: "groups", participants: 6, groups: 2, qualifyTeams: 2 });
  await call("POST", `/championships/${c._id}/stages`, { name: "Final", mode: "knockout", participants: 2 });
  const [groupStage, finalStage] = await call("GET", `/championships/${c._id}/stages`);
  await call("POST", `/championships/${c._id}/generate-fixture/${groupStage._id}`);
  await call("DELETE", `/championships/${c._id}/delete-fixture/${groupStage._id}`);
  const afterDelete = (await call("GET", `/championships/${c._id}/stages`))[0];
  check(afterDelete.status === "pendiente" && !afterDelete.groupsTeams?.length, "delete-fixture no devolvió la etapa a pendiente sin grupos");
  const { total: leftover } = await call("GET", `/rounds?championship=${c._id}`);
  check(leftover === 0, `delete-fixture dejó ${leftover} jornadas`);
  await call("POST", `/championships/${c._id}/generate-fixture/${groupStage._id}`);
  await playStage(c._id, { ...groupStage, mode: "groups" });
  await call("POST", `/championships/${c._id}/generate-fixture/${finalStage._id}`);
  await expectError("borrar fixture con la etapa siguiente generada", () => call("DELETE", `/championships/${c._id}/delete-fixture/${groupStage._id}`), "etapa siguiente");
  // Reintentar el avance de una etapa ya cerrada no debe cambiar nada
  await call("POST", `/championships/${c._id}/stages/${groupStage._id}/advance`);
  const stagesAfter = await call("GET", `/championships/${c._id}/stages`);
  check(stagesAfter[0].status === "finalizada" && stagesAfter[1].status === "generada", "advance alteró estados de etapas");
  const { total: finalRounds } = await call("GET", `/rounds?championship=${c._id}&stage=${finalStage._id}`);
  check(finalRounds === 1, `advance creó rondas extra (${finalRounds})`);
  out(` ✓ validaciones probadas`);
}

// ───────────────────────── corrección de penales ─────────────────────────
/** Juega un partido con un marcador fijo (y penales opcionales). */
async function playFixedMatch(championshipId: string, stageId: string, match: PlayedMatch & { round: any }, lg: number, vg: number, penalties?: [number, number]) {
  const roundId = String(match.round?._id ?? match.round);
  const vocalia = await call("POST", `/matchs/${match._id}/start`);
  const scorers = [...Array(lg).fill(match.localTeam), ...Array(vg).fill(match.visitorTeam)];
  for (const team of scorers) {
    await call("POST", "/matchs-events", { vocalia: vocalia._id, match: match._id, championship: championshipId, stage: stageId, round: roundId, team, minute: 10, type: "gol" });
  }
  await call("POST", `/matchs-reports/${vocalia._id}/finalizar`, {
    status: "finalizado",
    ...(penalties ? { localPenalties: penalties[0], visitorPenalties: penalties[1] } : {}),
  });
}

async function runPenaltiesCorrectionScenario() {
  out("\n═══ Corrección de penales (PUT /matchs/:id/penalties) ═══");
  const failuresBefore = failures.length;
  const teams = await createTeams(4);
  const c = await call("POST", "/championships", { name: "Corrección penales", category: categoryId, season: new Date().toISOString(), teams: teams.map((team) => ({ team })) });
  await call("POST", `/championships/${c._id}/stages`, { name: "Copa", mode: "knockout", participants: 4 });
  const [stage] = await call("GET", `/championships/${c._id}/stages`);
  await call("POST", `/championships/${c._id}/generate-fixture/${stage._id}`);
  const penalties = (id: string, lp: number, vp: number) => call("PUT", `/matchs/${id}/penalties`, { localPenalties: lp, visitorPenalties: vp });

  // Semifinales: la 1 empatada (gana local 5-4), la 2 sin empate
  const [semis] = await getRounds(c._id, stage._id);
  const [s1, s2] = (await getMatches(semis._id)).sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0));
  await playFixedMatch(c._id, stage._id, { ...s1, round: semis._id }, 1, 1, [5, 4]);
  await playFixedMatch(c._id, stage._id, { ...s2, round: semis._id }, 2, 0);

  await expectError("penales en partido sin empate", () => penalties(s2._id, 4, 3), "no terminó empatado");
  await expectError("penales empatados", () => penalties(s1._id, 4, 4), "no pueden terminar empatados");
  await penalties(s1._id, 6, 4); // mismo ganador: permitido
  const s1After = (await getMatches(semis._id)).find((m) => m._id === s1._id)!;
  check(s1After.localPenalties === 6 && s1After.visitorPenalties === 4, "no se guardó la corrección 6-4");
  await expectError("invertir ganador con la final ya generada", () => penalties(s1._id, 3, 4), "siguiente ronda");

  // Final empatada, luego se borran sus penales (como un partido viejo)
  const rounds = await getRounds(c._id, stage._id);
  const finalRound = rounds.find((r) => r.round === 2)!;
  const [final] = await getMatches(finalRound._id);
  await playFixedMatch(c._id, stage._id, { ...final, round: finalRound._id }, 0, 0, [4, 2]);
  let champ = await call("GET", `/championships/${c._id}`);
  check(String(champ.champion) === final.localTeam, "el campeón no es el ganador de la final por penales");
  await mongoose.connection.collection("matches").updateOne(
    { _id: new mongoose.Types.ObjectId(final._id) },
    { $unset: { localPenalties: "", visitorPenalties: "" } },
  );
  // Registrar penales al "partido viejo" con el otro ganador: recalcula el podio
  await penalties(final._id, 3, 5);
  champ = await call("GET", `/championships/${c._id}`);
  check(String(champ.champion) === final.visitorTeam && String(champ.runnerUp) === final.localTeam, "no se recalculó el podio tras corregir penales de la final");
  log(`   Campeón tras corrección: ${name(champ.champion)} · Subcampeón: ${name(champ.runnerUp)}`);

  // Liga: no se aceptan penales
  const leagueTeams = await createTeams(2);
  const l = await call("POST", "/championships", { name: "Liga corta", category: categoryId, season: new Date().toISOString(), teams: leagueTeams.map((team) => ({ team })) });
  await call("POST", `/championships/${l._id}/stages`, { name: "Liga", mode: "round_robin", participants: 2 });
  const [ls] = await call("GET", `/championships/${l._id}/stages`);
  await call("POST", `/championships/${l._id}/generate-fixture/${ls._id}`);
  const [lr] = await getRounds(l._id, ls._id);
  const [lm] = await getMatches(lr._id);
  await playFixedMatch(l._id, ls._id, { ...lm, round: lr._id }, 1, 1);
  await expectError("penales en liga", () => penalties(lm._id, 4, 3), "eliminación directa");

  const ok = failures.length === failuresBefore;
  out(` ${ok ? "✓" : "✗"} corrección de penales: ${ok ? "todas las verificaciones OK" : `${failures.length - failuresBefore} fallas`}`);
}

// ───────────────────────── main ─────────────────────────
const scenarios: Scenario[] = [
  {
    title: "Liga 6 equipos (una vuelta)",
    teams: 6,
    stages: [{ name: "Fase regular", mode: "round_robin", participants: 6 }],
  },
  {
    title: "Liga 5 equipos ida y vuelta (impar, con descanso)",
    teams: 5,
    stages: [{ name: "Fase regular", mode: "round_robin_double", participants: 5 }],
  },
  {
    title: "Liga 8 + playoffs con tercer lugar",
    teams: 8,
    stages: [
      { name: "Fase regular", mode: "round_robin", participants: 8, qualifyTeams: 4 },
      { name: "Playoffs", mode: "knockout", participants: 4, thirdPlaceMatch: true },
    ],
  },
  {
    title: "Mundialito: 16 equipos, 4 grupos → llave de 8",
    teams: 16,
    stages: [
      { name: "Fase de grupos", mode: "groups", participants: 16, groups: 4, qualifyTeams: 8 },
      { name: "Eliminatorias", mode: "knockout", participants: 8, thirdPlaceMatch: true },
    ],
  },
  {
    title: "Grupos desiguales: 10 equipos, 3 grupos → hexagonal",
    teams: 10,
    stages: [
      { name: "Fase de grupos", mode: "groups", participants: 10, groups: 3, qualifyTeams: 6 },
      { name: "Hexagonal final", mode: "round_robin", participants: 6 },
    ],
  },
  {
    title: "Copa directa de 8 (knockout como primera etapa)",
    teams: 8,
    stages: [{ name: "Copa", mode: "knockout", participants: 8 }],
  },
  {
    title: "Knockout encadenado: cuartos como etapa → semis y final",
    teams: 8,
    stages: [
      { name: "Cuartos", mode: "knockout", participants: 8, qualifyTeams: 4 },
      { name: "Final four", mode: "knockout", participants: 4, qualifyTeams: 1, thirdPlaceMatch: true },
    ],
  },
];

async function main() {
  out(`Simulación de competiciones · semilla ${SEED} · base ${URI}`);
  await setup();
  try {
    for (const scenario of scenarios) await runScenario(scenario);
    await runValidationScenario();
    await runPenaltiesCorrectionScenario();
  } finally {
    await app?.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  out(`\n${checks} verificaciones · ${failures.length} fallas`);
  if (failures.length) {
    failures.forEach((f) => out(` ✗ ${f}`));
    process.exit(1);
  }
}

main().catch(async (e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  await mongoose.connection.dropDatabase().catch(() => undefined);
  process.exit(1);
});
