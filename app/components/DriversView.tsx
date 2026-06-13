"use client";

import { useMemo, useState } from "react";
import {
  aggregateByDriver,
  OUTCOME_COLORS,
  OUTCOME_LABELS,
  type CaseOutcomeType,
  type CaseRow,
  type DriverAggregate,
} from "../lib/incidents";
import { CaseDetail } from "./CaseDetail";

const PENALTY_TYPES: CaseOutcomeType[] = [
  "time_penalty",
  "drive_through",
  "stop_and_go",
  "grid_penalty",
  "black_flag",
  "reprimand",
  "penalty_points",
];

type SortKey =
  | "cases"
  | "penalties"
  | "seconds"
  | "points"
  | "noAction"
  | "investigation";

export function DriversView({ rows }: { rows: CaseRow[] }) {
  const aggregates = useMemo(() => aggregateByDriver(rows), [rows]);
  const [sortBy, setSortBy] = useState<SortKey>("cases");
  const [selectedDriver, setSelectedDriver] = useState<DriverAggregate | null>(null);
  const [caseFromDriver, setCaseFromDriver] = useState<CaseRow | null>(null);

  const sorted = useMemo(() => {
    const c = [...aggregates];
    const penaltyTotal = (a: DriverAggregate) =>
      PENALTY_TYPES.reduce((s, k) => s + (a.byOutcome[k] ?? 0), 0);
    switch (sortBy) {
      case "cases":
        return c.sort((a, b) => b.totalCases - a.totalCases);
      case "penalties":
        return c.sort((a, b) => penaltyTotal(b) - penaltyTotal(a));
      case "seconds":
        return c.sort((a, b) => b.totalPenaltySeconds - a.totalPenaltySeconds);
      case "points":
        return c.sort((a, b) => b.totalPenaltyPoints - a.totalPenaltyPoints);
      case "noAction":
        return c.sort(
          (a, b) => (b.byOutcome.no_action ?? 0) - (a.byOutcome.no_action ?? 0),
        );
      case "investigation":
        return c.sort(
          (a, b) =>
            ((b.byOutcome.under_investigation ?? 0) +
              (b.byOutcome.noted ?? 0)) -
            ((a.byOutcome.under_investigation ?? 0) +
              (a.byOutcome.noted ?? 0)),
        );
    }
  }, [aggregates, sortBy]);

  return (
    <div className="flex flex-col h-[calc(100vh-72px)]">
      <div className="px-6 py-3 border-b border-white/5 bg-black/40 backdrop-blur flex flex-wrap items-center gap-3">
        <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40">
          Sort by
        </div>
        <div className="flex bg-zinc-900 border border-white/10 rounded-md p-0.5">
          {([
            ["cases", "Total"],
            ["penalties", "Penalties"],
            ["seconds", "Penalty Sec."],
            ["points", "Pen. Points"],
            ["noAction", "Cleared"],
            ["investigation", "Inquiries"],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-3 py-1.5 text-[10px] font-display tracking-[0.2em] uppercase rounded transition ${
                sortBy === key ? "bg-white text-black" : "text-white/50 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-white/50 font-display tracking-widest uppercase">
          {sorted.length} drivers
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
          {sorted.map((d) => (
            <DriverCard
              key={d.number}
              d={d}
              onClick={() => setSelectedDriver(d)}
            />
          ))}
        </div>
      </div>

      {selectedDriver && (
        <DriverDrawer
          d={selectedDriver}
          onClose={() => setSelectedDriver(null)}
          onCaseClick={(c) => setCaseFromDriver(c)}
        />
      )}

      <CaseDetail c={caseFromDriver} onClose={() => setCaseFromDriver(null)} />
    </div>
  );
}

function DriverCard({ d, onClick }: { d: DriverAggregate; onClick: () => void }) {
  const penalties = PENALTY_TYPES.reduce(
    (s, k) => s + (d.byOutcome[k] ?? 0),
    0,
  );
  const cleared = d.byOutcome.no_action ?? 0;
  const investigated =
    (d.byOutcome.under_investigation ?? 0) + (d.byOutcome.noted ?? 0);

  return (
    <button
      onClick={onClick}
      className="text-left bg-gradient-to-b from-white/[0.05] to-white/[0.02] hover:from-white/[0.08] border border-white/10 hover:border-white/30 rounded-xl px-5 py-4 transition group"
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <div className="font-display text-2xl text-white tracking-wide">
            {d.acronym}
          </div>
          <div className="text-[10px] font-display tracking-widest uppercase text-white/40 tabular-nums">
            #{d.number} · {d.yearsActive.join("/")}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl tabular-nums text-white">
            {d.totalCases}
          </div>
          <div className="text-[10px] font-display tracking-widest uppercase text-white/40">
            cases
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Mini label="Penalties" value={penalties} color={OUTCOME_COLORS.time_penalty} />
        <Mini label="Cleared" value={cleared} color={OUTCOME_COLORS.no_action} />
        <Mini label="Inquiries" value={investigated} color={OUTCOME_COLORS.under_investigation} />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <Stat label="Pen. sec" value={`${d.totalPenaltySeconds}`} />
        <Stat label="Pen. pts" value={`${d.totalPenaltyPoints}`} />
        <Stat label="Grid pos" value={`${d.totalGridPlaces}`} />
      </div>

      {d.topReasons.length > 0 && (
        <div>
          <div className="text-[10px] font-display tracking-widest uppercase text-white/40 mb-1">
            Most cited
          </div>
          <ol className="space-y-0.5">
            {d.topReasons.slice(0, 3).map((r) => (
              <li
                key={r.reason}
                className="flex items-baseline gap-2 text-xs text-white/70 truncate"
              >
                <span className="text-white/30 tabular-nums w-5">
                  {r.count}×
                </span>
                <span className="truncate">{r.reason.toLowerCase()}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </button>
  );
}

function Mini({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-md bg-black/30 border border-white/5 px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="font-display text-[10px] tracking-widest uppercase text-white/40">
          {label}
        </span>
      </div>
      <div className="font-display text-lg tabular-nums text-white">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <div className="text-[10px] font-display tracking-widest uppercase text-white/40">
        {label}
      </div>
      <div className="font-display tabular-nums text-white">{value}</div>
    </div>
  );
}

function DriverDrawer({
  d,
  onClose,
  onCaseClick,
}: {
  d: DriverAggregate;
  onClose: () => void;
  onCaseClick: (c: CaseRow) => void;
}) {
  const penalties = PENALTY_TYPES.reduce(
    (s, k) => s + (d.byOutcome[k] ?? 0),
    0,
  );
  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative ml-auto w-full max-w-3xl h-full bg-zinc-950 border-l border-white/10 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 h-9 w-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white grid place-items-center transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path
              d="M1 1L13 13M13 1L1 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="px-8 pt-8 pb-6 border-b border-white/5">
          <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40">
            Driver Profile · {d.yearsActive.join(" / ")}
          </div>
          <div className="font-display text-5xl text-white mt-1">
            {d.acronym}
            <span className="text-white/30 text-2xl ml-3 tabular-nums">
              #{d.number}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <BigStat label="Total cases" value={d.totalCases} />
            <BigStat
              label="Penalties"
              value={penalties}
              color={OUTCOME_COLORS.time_penalty}
            />
            <BigStat label="Penalty seconds" value={d.totalPenaltySeconds} />
            <BigStat label="Penalty points" value={d.totalPenaltyPoints} />
          </div>
        </div>

        <div className="px-8 py-6 border-b border-white/5">
          <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40 mb-3">
            Outcome Breakdown
          </div>
          <div className="space-y-2">
            {(Object.entries(d.byOutcome) as [CaseOutcomeType, number][])
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <Bar
                  key={k}
                  label={OUTCOME_LABELS[k]}
                  value={v}
                  total={d.totalCases}
                  color={OUTCOME_COLORS[k]}
                />
              ))}
          </div>
        </div>

        {d.topReasons.length > 0 && (
          <div className="px-8 py-6 border-b border-white/5">
            <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40 mb-3">
              Top Reasons Cited
            </div>
            <ol className="space-y-1.5">
              {d.topReasons.map((r) => (
                <li key={r.reason} className="flex items-baseline gap-3 text-sm">
                  <span className="font-display text-white/50 tabular-nums w-7">
                    {r.count}×
                  </span>
                  <span className="text-white/90">{r.reason}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="px-8 py-6">
          <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40 mb-3">
            Recent cases
          </div>
          <ol className="space-y-2">
            {d.recentCases.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onCaseClick(c)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/[0.04] transition"
                >
                  <span
                    className="w-1 h-8 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: OUTCOME_COLORS[c.outcome as CaseOutcomeType] }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/70 truncate">
                      <span className="font-display tracking-widest uppercase text-white/50">
                        {c.session.country} {c.session.year} · {c.session.name}
                      </span>
                      {c.lap != null && (
                        <span className="text-white/40"> · L{c.lap}</span>
                      )}
                    </div>
                    {c.reason && (
                      <div className="text-sm text-white/90 truncate">
                        {c.reason.toLowerCase()}
                      </div>
                    )}
                  </div>
                  <div
                    className="font-display text-xs tracking-wide"
                    style={{ color: OUTCOME_COLORS[c.outcome as CaseOutcomeType] }}
                  >
                    {OUTCOME_LABELS[c.outcome as CaseOutcomeType]}
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40">
        {label}
      </div>
      <div
        className="font-display text-2xl tabular-nums leading-tight"
        style={{ color: color ?? "white" }}
      >
        {value}
      </div>
    </div>
  );
}

function Bar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="w-32 flex-shrink-0 font-display tracking-widest uppercase text-[10px] text-white/60">
        {label}
      </div>
      <div className="flex-1 h-3 bg-white/[0.04] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ backgroundColor: color, width: `${pct}%` }}
        />
      </div>
      <div className="w-12 text-right font-display tabular-nums text-white">
        {value}
      </div>
    </div>
  );
}
