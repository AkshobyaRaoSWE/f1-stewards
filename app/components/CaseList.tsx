"use client";

import { useMemo, useState } from "react";
import {
  OUTCOME_COLORS,
  OUTCOME_LABELS,
  searchMatches,
  SEVERITY_RANK,
  summarizeOutcome,
  type CaseOutcomeType,
  type CaseRow,
} from "../lib/incidents";
import { CaseDetail } from "./CaseDetail";

const OUTCOME_GROUPS: { id: string; label: string; types: CaseOutcomeType[] }[] = [
  { id: "all", label: "All", types: [] },
  { id: "penalty", label: "Penalty", types: ["time_penalty", "stop_and_go", "drive_through", "grid_penalty", "black_flag"] },
  { id: "reprimand", label: "Reprimand / Points", types: ["reprimand", "penalty_points"] },
  { id: "no_action", label: "No Action", types: ["no_action"] },
  { id: "open", label: "Investigation", types: ["under_investigation", "noted"] },
  { id: "procedural", label: "Procedural", types: ["procedural"] },
];

export function CaseList({ rows: all }: { rows: CaseRow[] }) {
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState<string>("all");
  const [country, setCountry] = useState<string>("all");
  const [sessionType, setSessionType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "severity">("recent");
  const [selected, setSelected] = useState<CaseRow | null>(null);

  const countries = useMemo(() => {
    const s = new Set<string>();
    for (const c of all) s.add(c.session.country);
    return [...s].sort();
  }, [all]);
  const sessionTypes = useMemo(() => {
    const s = new Set<string>();
    for (const c of all) s.add(c.session.type);
    return [...s].sort();
  }, [all]);

  const filtered = useMemo(() => {
    const grp = OUTCOME_GROUPS.find((g) => g.id === bucket);
    let out = all.filter((c) => {
      if (grp && grp.types.length && !grp.types.includes(c.outcome as CaseOutcomeType)) return false;
      if (country !== "all" && c.session.country !== country) return false;
      if (sessionType !== "all" && c.session.type !== sessionType) return false;
      return searchMatches(c, q);
    });
    if (sortBy === "severity") {
      out = [...out].sort(
        (a, b) =>
          SEVERITY_RANK[b.outcome as CaseOutcomeType] -
          SEVERITY_RANK[a.outcome as CaseOutcomeType],
      );
    }
    return out;
  }, [all, q, bucket, country, sessionType, sortBy]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of all) {
      out[c.outcome] = (out[c.outcome] ?? 0) + 1;
    }
    return out;
  }, [all]);

  return (
    <div className="flex flex-col h-[calc(100vh-72px)]">
      <Toolbar
        q={q}
        setQ={setQ}
        bucket={bucket}
        setBucket={setBucket}
        country={country}
        setCountry={setCountry}
        countries={countries}
        sessionType={sessionType}
        setSessionType={setSessionType}
        sessionTypes={sessionTypes}
        sortBy={sortBy}
        setSortBy={setSortBy}
        total={all.length}
        showing={filtered.length}
      />

      <div className="px-6 py-3 border-b border-white/5 flex flex-wrap gap-2">
        {(["time_penalty", "no_action", "reprimand", "grid_penalty", "penalty_points", "under_investigation"] as CaseOutcomeType[]).map(
          (k) => (
            <span
              key={k}
              className="text-[10px] font-display tracking-widest uppercase px-2 py-1 rounded-full border border-white/10 text-white/60 flex items-center gap-1.5"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: OUTCOME_COLORS[k] }}
              />
              {OUTCOME_LABELS[k]}: {counts[k] ?? 0}
            </span>
          ),
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-10 text-center text-white/40 font-display tracking-widest uppercase text-xs">
            No cases match
          </div>
        )}
        <ol className="divide-y divide-white/5">
          {filtered.map((c) => (
            <CaseRowItem key={c.id} c={c} onClick={() => setSelected(c)} />
          ))}
        </ol>
      </div>

      <CaseDetail c={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function CaseRowItem({ c, onClick }: { c: CaseRow; onClick: () => void }) {
  const color = OUTCOME_COLORS[c.outcome as CaseOutcomeType];
  const summary = summarizeOutcome(c);
  return (
    <li>
      <button
        onClick={onClick}
        className="group w-full px-6 py-4 flex items-center gap-5 text-left hover:bg-white/[0.03] transition"
      >
        <div className="w-1 h-12 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
        <div className="w-44 flex-shrink-0">
          <div className="text-[11px] font-display tracking-[0.25em] uppercase text-white/50">
            {c.session.country}{" "}
            <span className="text-white/30">{c.session.year}</span>
          </div>
          <div className="text-xs text-white/60 mt-0.5">
            {c.session.name}
            {c.lap != null && ` · L${c.lap}`}
            {c.turn != null && ` · T${c.turn}`}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            {c.cars.length === 0 && (
              <span className="text-white/40 text-sm italic">No driver tagged</span>
            )}
            {c.cars.map((car) => (
              <span key={car.number} className="font-display text-sm text-white">
                <span className="text-white/40 text-xs mr-1 tabular-nums">
                  #{car.number}
                </span>
                {car.acronym}
              </span>
            ))}
            {c.reason && (
              <span className="text-white/70 text-sm truncate">— {c.reason.toLowerCase()}</span>
            )}
          </div>
          <div className="text-[11px] text-white/40 mt-1 truncate">
            {c.events.length} event{c.events.length === 1 ? "" : "s"} · click to read
          </div>
        </div>

        <div className="text-right">
          <div
            className="font-display text-sm tracking-wide"
            style={{ color }}
          >
            {summary}
          </div>
          <div className="text-[11px] text-white/40">
            {OUTCOME_LABELS[c.outcome as CaseOutcomeType]}
          </div>
        </div>
      </button>
    </li>
  );
}

function Toolbar({
  q,
  setQ,
  bucket,
  setBucket,
  country,
  setCountry,
  countries,
  sessionType,
  setSessionType,
  sessionTypes,
  sortBy,
  setSortBy,
  total,
  showing,
}: {
  q: string;
  setQ: (s: string) => void;
  bucket: string;
  setBucket: (s: string) => void;
  country: string;
  setCountry: (s: string) => void;
  countries: string[];
  sessionType: string;
  setSessionType: (s: string) => void;
  sessionTypes: string[];
  sortBy: "recent" | "severity";
  setSortBy: (s: "recent" | "severity") => void;
  total: number;
  showing: number;
}) {
  return (
    <div className="px-6 py-3 border-b border-white/5 bg-black/40 backdrop-blur space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by driver, reason, race…"
            className="w-full bg-zinc-900 border border-white/10 hover:border-white/30 focus:border-white/50 rounded-md pl-9 pr-3 py-2 text-sm text-white outline-none transition"
          />
          <svg
            className="absolute top-2.5 left-3 text-white/40"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle
              cx="7"
              cy="7"
              r="5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="m11 11 3 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="bg-zinc-900 border border-white/10 hover:border-white/30 text-white text-sm px-3 py-2 rounded-md cursor-pointer focus:outline-none focus:border-white/50 transition"
        >
          <option value="all">All races</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={sessionType}
          onChange={(e) => setSessionType(e.target.value)}
          className="bg-zinc-900 border border-white/10 hover:border-white/30 text-white text-sm px-3 py-2 rounded-md cursor-pointer focus:outline-none focus:border-white/50 transition"
        >
          <option value="all">All sessions</option>
          {sessionTypes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="flex bg-zinc-900 border border-white/10 rounded-md p-0.5">
          {(["recent", "severity"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 text-[10px] font-display tracking-[0.2em] uppercase rounded transition ${
                sortBy === s
                  ? "bg-white text-black"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-white/50 font-display tracking-widest uppercase">
          <span className="text-white">{showing}</span>{" "}
          of {total}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {OUTCOME_GROUPS.map((g) => (
          <button
            key={g.id}
            onClick={() => setBucket(g.id)}
            className={`px-3 py-1 text-[10px] font-display tracking-[0.2em] uppercase rounded-full border transition ${
              bucket === g.id
                ? "bg-white text-black border-transparent"
                : "border-white/10 text-white/50 hover:text-white"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
    </div>
  );
}
