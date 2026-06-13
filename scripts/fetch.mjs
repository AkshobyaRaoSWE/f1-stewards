// Fetch all 2024 race-control messages from OpenF1, parse into structured
// incidents and group related ones into cases. Writes to public/incidents.json.
// Run: `node scripts/fetch.mjs`

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dir, "../public/incidents.json");
const API = "https://api.openf1.org/v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Token bucket
class Limiter {
  constructor(rps) {
    this.rps = rps;
    this.tokens = rps;
    this.last = Date.now();
  }
  refill() {
    const now = Date.now();
    const dt = (now - this.last) / 1000;
    this.tokens = Math.min(this.rps, this.tokens + dt * this.rps);
    this.last = now;
  }
  async acquire() {
    while (true) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      await sleep(((1 - this.tokens) / this.rps) * 1000 + 10);
    }
  }
}
const limiter = new Limiter(4);

async function get(path, attempt = 0) {
  await limiter.acquire();
  const url = `${API}/${path}`;
  const r = await fetch(url);
  if (r.status === 429) {
    if (attempt > 8) throw new Error(`${url} → 429 retries exceeded`);
    await sleep(1500 * Math.pow(1.6, attempt));
    return get(path, attempt + 1);
  }
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

const KEYWORDS =
  /\b(INCIDENT|PENALTY|PENALISED|REPRIMAND|INVESTIGATION|STEWARDS|NOTED|REVIEWED|DRIVE.THROUGH|STOP.AND.GO|UNSPORTSMANLIKE|TRACK LIMITS|UNSAFE RELEASE|FORMATION LAP|JUMP START|FALSE START|BLACK FLAG|RACE DIRECTOR)\b/i;

function classify(msg) {
  const m = msg.toUpperCase();
  if (/(\d+)\s+SECOND.*PENALTY/.test(m))
    return { type: "time_penalty", seconds: Number(m.match(/(\d+)\s+SECOND/)[1]) };
  if (/STOP.AND.GO/.test(m)) return { type: "stop_and_go" };
  if (/DRIVE.THROUGH/.test(m)) return { type: "drive_through" };
  if (/(\d+)\s+(?:PLACE|POSITION|GRID).*GRID PENALTY/.test(m))
    return { type: "grid_penalty", places: Number(m.match(/(\d+)/)[1]) };
  if (/REPRIMAND/.test(m)) return { type: "reprimand" };
  if (/(\d+)\s+PENALTY POINTS?/.test(m))
    return { type: "penalty_points", points: Number(m.match(/(\d+)/)[1]) };
  if (/BLACK FLAG/.test(m)) return { type: "black_flag" };
  if (/(NO FURTHER (?:ACTION|INVESTIGATION)|TAKE NO ACTION)/.test(m))
    return { type: "no_action" };
  if (/UNDER INVESTIGATION/.test(m)) return { type: "under_investigation" };
  if (/\bNOTED\b/.test(m)) return { type: "noted" };
  if (/FORMATION LAP|JUMP START|FALSE START|UNSAFE RELEASE/.test(m))
    return { type: "procedural" };
  return { type: "other" };
}

function parseMessage(m, drivers) {
  if (!KEYWORDS.test(m.message)) return null;

  const msg = m.message;
  const cars = [];
  const carRe = /CAR\s+(\d+)\s*\(([A-Z]{3})\)/g;
  let mt;
  while ((mt = carRe.exec(msg))) {
    cars.push({ number: Number(mt[1]), acronym: mt[2] });
  }
  // Fall back to single-driver lookup via driver_number
  if (cars.length === 0 && m.driver_number) {
    const d = drivers.find((x) => x.driver_number === m.driver_number);
    if (d) cars.push({ number: d.driver_number, acronym: d.name_acronym });
  }

  const lapMatch = msg.match(/LAP\s+(\d+)/i);
  const turnMatch = msg.match(/TURN\s+(\d+)/i);
  const cls = classify(msg);

  // Reason — text after the last " - " up to end (uppercase phrase)
  let reason = null;
  const dash = msg.lastIndexOf(" - ");
  if (dash !== -1) {
    const tail = msg.slice(dash + 3).trim();
    // Don't grab penalty descriptions as reason
    if (
      !/PENALTY|REPRIMAND|NO FURTHER|INVESTIGATION|NOTED|PLACE GRID|INFRINGEMENT/i.test(
        tail.split(/\s+/).slice(0, 3).join(" "),
      )
    ) {
      reason = tail;
    }
  }
  // For NOTED messages, strip leading "FIA STEWARDS:" then look for "- REASON" chunk
  if (!reason) {
    const r2 = msg.match(/-\s+([A-Z][A-Z ,/']{4,})\s*$/);
    if (r2) reason = r2[1].trim();
  }

  return {
    date: m.date,
    lap: lapMatch ? Number(lapMatch[1]) : m.lap_number ?? null,
    turn: turnMatch ? Number(turnMatch[1]) : null,
    cars,
    type: cls.type,
    seconds: cls.seconds ?? null,
    places: cls.places ?? null,
    points: cls.points ?? null,
    reason,
    message: msg,
  };
}

// Group related messages into cases by (cars, lap, reason).
function groupIntoCases(parsed) {
  const cases = [];

  function caseKey(p) {
    const carIds = p.cars.map((c) => c.number).sort((a, b) => a - b).join("-");
    const reason = p.reason ? p.reason.replace(/\s+/g, " ").trim() : "";
    const lapBucket = p.lap ?? "";
    return `${carIds}|${lapBucket}|${reason}`;
  }

  const buckets = new Map();
  for (const p of parsed) {
    const k = caseKey(p);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(p);
  }

  for (const [k, events] of buckets) {
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Determine outcome from all events in case
    let outcome = "noted";
    let outcomeDetail = null;
    let penaltyEvent = null;
    for (const e of events) {
      if (
        ["time_penalty", "stop_and_go", "drive_through", "grid_penalty", "reprimand", "penalty_points", "black_flag"].includes(e.type)
      ) {
        outcome = e.type;
        outcomeDetail = e;
        penaltyEvent = e;
      } else if (
        e.type === "no_action" &&
        outcome !== "time_penalty" &&
        !penaltyEvent
      ) {
        outcome = "no_action";
      } else if (e.type === "under_investigation" && outcome === "noted") {
        outcome = "under_investigation";
      }
    }

    cases.push({
      cars: events[0].cars,
      lap: events[0].lap,
      turn: events[0].turn,
      reason: events.find((e) => e.reason)?.reason ?? null,
      outcome,
      outcomeDetail: penaltyEvent
        ? {
            type: penaltyEvent.type,
            seconds: penaltyEvent.seconds,
            places: penaltyEvent.places,
            points: penaltyEvent.points,
          }
        : null,
      events: events.map((e) => ({
        date: e.date,
        type: e.type,
        message: e.message,
      })),
      key: k,
    });
  }

  return cases;
}

async function processSession(session) {
  const [rc, drivers] = await Promise.all([
    get(`race_control?session_key=${session.session_key}`),
    get(`drivers?session_key=${session.session_key}`),
  ]);

  const parsed = rc
    .map((m) => parseMessage(m, drivers))
    .filter(Boolean);
  const cases = groupIntoCases(parsed);

  return {
    sessionKey: session.session_key,
    sessionType: session.session_type,
    sessionName: session.session_name,
    country: session.country_name,
    location: session.location,
    circuit: session.circuit_short_name,
    date: session.date_start,
    year: session.year,
    cases,
    rawMessages: rc.length,
    parsedMessages: parsed.length,
  };
}

async function main() {
  const yearArg = process.argv.find((a) => a.startsWith("--years="));
  const years = yearArg
    ? yearArg.split("=")[1].split(",").map((y) => Number(y.trim()))
    : [2024, 2025, 2026];
  console.log(`Fetching seasons: ${years.join(", ")}`);

  const allSessions = [];
  for (const year of years) {
    const sessions = await get(`sessions?year=${year}`);
    const interesting = sessions.filter((s) =>
      /Race|Sprint|Qualifying/i.test(s.session_name),
    );
    console.log(`\n=== ${year}: ${interesting.length} sessions ===`);

    for (const s of interesting) {
      try {
        const out = await processSession(s);
        console.log(
          `[${s.session_key}] ${s.year} ${s.country_name} ${s.session_name}: ` +
            `${out.cases.length} cases (${out.parsedMessages}/${out.rawMessages} parsed)`,
        );
        allSessions.push(out);
        // Incremental write so partial data is usable
        if (allSessions.length % 5 === 0) {
          await writeOut(allSessions);
        }
      } catch (e) {
        console.error(`[${s.session_key}] FAILED: ${e.message}`);
      }
    }
  }

  await writeOut(allSessions);
  const total = allSessions.reduce((n, s) => n + s.cases.length, 0);
  console.log(
    `\nWrote ${allSessions.length} sessions across ${years.length} years, ${total} cases → ${OUT}`,
  );
}

async function writeOut(allSessions) {
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      { generated: new Date().toISOString(), sessions: allSessions },
      null,
      1,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
