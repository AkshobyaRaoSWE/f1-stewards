export type Car = { number: number; acronym: string };

export type IncidentEvent = {
  date: string;
  type: string;
  message: string;
};

export type CaseOutcomeType =
  | "noted"
  | "under_investigation"
  | "no_action"
  | "time_penalty"
  | "drive_through"
  | "stop_and_go"
  | "grid_penalty"
  | "reprimand"
  | "penalty_points"
  | "black_flag"
  | "procedural"
  | "other";

export type StewardsCase = {
  cars: Car[];
  lap: number | null;
  turn: number | null;
  reason: string | null;
  outcome: CaseOutcomeType;
  outcomeDetail: {
    type: string;
    seconds?: number | null;
    places?: number | null;
    points?: number | null;
  } | null;
  events: IncidentEvent[];
  key: string;
};

export type SessionData = {
  sessionKey: number;
  sessionType: string;
  sessionName: string;
  country: string;
  location: string;
  circuit: string;
  date: string;
  year: number;
  cases: StewardsCase[];
  rawMessages: number;
  parsedMessages: number;
};

export type IncidentsFile = {
  generated: string;
  sessions: SessionData[];
};

// Flatten all cases with session info embedded for searching/filtering.
export type CaseRow = StewardsCase & {
  id: string;
  session: {
    key: number;
    name: string;
    type: string;
    country: string;
    location: string;
    date: string;
    year: number;
  };
};

export function flatten(file: IncidentsFile): CaseRow[] {
  const rows: CaseRow[] = [];
  for (const s of file.sessions) {
    for (let i = 0; i < s.cases.length; i++) {
      const c = s.cases[i];
      rows.push({
        ...c,
        id: `${s.sessionKey}-${i}`,
        session: {
          key: s.sessionKey,
          name: s.sessionName,
          type: s.sessionType,
          country: s.country,
          location: s.location,
          date: s.date,
          year: s.year,
        },
      });
    }
  }
  // Sort newest first by session date, then within session by event time
  rows.sort((a, b) => {
    const dt = new Date(b.session.date).getTime() - new Date(a.session.date).getTime();
    if (dt !== 0) return dt;
    const ae = a.events[0]?.date ?? a.session.date;
    const be = b.events[0]?.date ?? b.session.date;
    return new Date(ae).getTime() - new Date(be).getTime();
  });
  return rows;
}

export const OUTCOME_LABELS: Record<CaseOutcomeType, string> = {
  noted: "Noted",
  under_investigation: "Under Investigation",
  no_action: "No Action",
  time_penalty: "Time Penalty",
  drive_through: "Drive-Through",
  stop_and_go: "Stop-and-Go",
  grid_penalty: "Grid Penalty",
  reprimand: "Reprimand",
  penalty_points: "Penalty Points",
  black_flag: "Black Flag",
  procedural: "Procedural",
  other: "Other",
};

export const OUTCOME_COLORS: Record<CaseOutcomeType, string> = {
  time_penalty: "#E1252C",
  stop_and_go: "#E1252C",
  drive_through: "#E1252C",
  grid_penalty: "#FF8000",
  black_flag: "#000",
  reprimand: "#FFAA00",
  penalty_points: "#FF8000",
  no_action: "#27F4D2",
  under_investigation: "#FFEC1F",
  noted: "#888",
  procedural: "#6692FF",
  other: "#aaa",
};

export const SEVERITY_RANK: Record<CaseOutcomeType, number> = {
  black_flag: 100,
  stop_and_go: 80,
  drive_through: 70,
  time_penalty: 60,
  grid_penalty: 50,
  penalty_points: 40,
  reprimand: 30,
  procedural: 20,
  under_investigation: 15,
  noted: 10,
  no_action: 5,
  other: 0,
};

export function summarizeOutcome(c: StewardsCase): string {
  if (c.outcomeDetail) {
    const d = c.outcomeDetail;
    if (d.seconds) return `${d.seconds}-second penalty`;
    if (d.places) return `${d.places}-place grid penalty`;
    if (d.points) return `${d.points} penalty point${d.points === 1 ? "" : "s"}`;
  }
  return OUTCOME_LABELS[c.outcome];
}

export function searchMatches(c: CaseRow, q: string): boolean {
  if (!q) return true;
  const ql = q.toLowerCase();
  if (c.reason && c.reason.toLowerCase().includes(ql)) return true;
  if (c.session.country.toLowerCase().includes(ql)) return true;
  if (c.session.name.toLowerCase().includes(ql)) return true;
  for (const car of c.cars) {
    if (car.acronym.toLowerCase().includes(ql)) return true;
    if (`${car.number}`.includes(ql)) return true;
  }
  for (const e of c.events) {
    if (e.message.toLowerCase().includes(ql)) return true;
  }
  return false;
}

export type DriverAggregate = {
  number: number;
  acronym: string;
  totalCases: number;
  byOutcome: Record<CaseOutcomeType, number>;
  totalPenaltySeconds: number;
  totalPenaltyPoints: number;
  totalGridPlaces: number;
  topReasons: { reason: string; count: number }[];
  recentCases: CaseRow[];
  yearsActive: number[];
};

export function aggregateByDriver(rows: CaseRow[]): DriverAggregate[] {
  const map = new Map<number, DriverAggregate>();
  const reasonCounts = new Map<number, Map<string, number>>();

  for (const c of rows) {
    for (const car of c.cars) {
      let agg = map.get(car.number);
      if (!agg) {
        agg = {
          number: car.number,
          acronym: car.acronym,
          totalCases: 0,
          byOutcome: {} as Record<CaseOutcomeType, number>,
          totalPenaltySeconds: 0,
          totalPenaltyPoints: 0,
          totalGridPlaces: 0,
          topReasons: [],
          recentCases: [],
          yearsActive: [],
        };
        map.set(car.number, agg);
        reasonCounts.set(car.number, new Map());
      }
      agg.totalCases += 1;
      agg.byOutcome[c.outcome as CaseOutcomeType] =
        (agg.byOutcome[c.outcome as CaseOutcomeType] ?? 0) + 1;
      if (c.outcomeDetail) {
        if (c.outcomeDetail.seconds)
          agg.totalPenaltySeconds += c.outcomeDetail.seconds;
        if (c.outcomeDetail.points)
          agg.totalPenaltyPoints += c.outcomeDetail.points;
        if (c.outcomeDetail.places)
          agg.totalGridPlaces += c.outcomeDetail.places;
      }
      if (c.reason) {
        const rc = reasonCounts.get(car.number)!;
        rc.set(c.reason, (rc.get(c.reason) ?? 0) + 1);
      }
      if (!agg.yearsActive.includes(c.session.year))
        agg.yearsActive.push(c.session.year);
      agg.recentCases.push(c);
    }
  }

  for (const [num, agg] of map) {
    const rc = reasonCounts.get(num)!;
    agg.topReasons = [...rc.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    agg.recentCases.sort(
      (a, b) =>
        new Date(b.session.date).getTime() -
        new Date(a.session.date).getTime(),
    );
    agg.recentCases = agg.recentCases.slice(0, 30);
    agg.yearsActive.sort();
  }

  return [...map.values()].sort((a, b) => b.totalCases - a.totalCases);
}
