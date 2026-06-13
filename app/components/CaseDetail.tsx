"use client";

import { useEffect } from "react";
import {
  OUTCOME_COLORS,
  OUTCOME_LABELS,
  summarizeOutcome,
  type CaseOutcomeType,
  type CaseRow,
} from "../lib/incidents";

export function CaseDetail({
  c,
  onClose,
}: {
  c: CaseRow | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!c) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [c, onClose]);

  if (!c) return null;

  const color = OUTCOME_COLORS[c.outcome as CaseOutcomeType];

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative ml-auto w-full max-w-2xl h-full bg-zinc-950 border-l border-white/10 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          }}
        />

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
          <div className="flex items-baseline gap-2 mb-2">
            <span
              className="text-[10px] font-display tracking-[0.3em] uppercase"
              style={{ color }}
            >
              {OUTCOME_LABELS[c.outcome as CaseOutcomeType]}
            </span>
            <span className="text-[10px] text-white/40 font-display tracking-widest uppercase">
              · {c.session.country} {c.session.year}
            </span>
            <span className="text-[10px] text-white/40 font-display tracking-widest uppercase">
              · {c.session.name}
            </span>
          </div>

          <div className="font-display text-2xl text-white leading-tight">
            {c.cars.length === 0
              ? "No driver tagged"
              : c.cars.map((car, i) => (
                  <span key={car.number}>
                    {i > 0 && (
                      <span className="text-white/30 mx-2 text-base">vs</span>
                    )}
                    <span className="text-white/40 text-xl mr-1 tabular-nums">
                      #{car.number}
                    </span>
                    {car.acronym}
                  </span>
                ))}
          </div>

          {c.reason && (
            <div className="mt-3 text-white/80 text-base">
              {c.reason}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/60">
            {c.lap != null && (
              <Pill>Lap {c.lap}</Pill>
            )}
            {c.turn != null && <Pill>Turn {c.turn}</Pill>}
            <Pill style={{ color, borderColor: `${color}55` }}>
              {summarizeOutcome(c)}
            </Pill>
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40 mb-4">
            Timeline
          </div>
          <ol className="space-y-3">
            {c.events.map((e, i) => (
              <li
                key={`${e.date}-${e.type}-${i}`}
                className="flex gap-4 text-sm"
              >
                <div className="w-20 flex-shrink-0 font-mono text-[11px] text-white/40 pt-0.5 tabular-nums">
                  {fmtTime(e.date)}
                </div>
                <div className="flex-shrink-0 mt-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: OUTCOME_COLORS[e.type as CaseOutcomeType] ?? "#666" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm leading-relaxed break-words">
                    {e.message}
                  </div>
                  <div className="text-[10px] font-display tracking-widest uppercase text-white/40 mt-1">
                    {OUTCOME_LABELS[e.type as CaseOutcomeType] ?? e.type}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="px-8 pb-8">
          <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40 mb-3">
            Source
          </div>
          <div className="text-xs text-white/60 leading-relaxed">
            Live FIA race-control broadcast messages, fetched via OpenF1.
            Stewards' formal written decisions for this weekend live on{" "}
            <a
              href={`https://www.fia.com/documents/championships/fia-formula-one-world-championship-14`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline decoration-white/30 hover:decoration-white"
            >
              fia.com/documents
            </a>
            {" "}— search by event for the official PDF.
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className="px-2 py-0.5 text-[10px] font-display tracking-widest uppercase rounded-full border border-white/15"
      style={style}
    >
      {children}
    </span>
  );
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toISOString().substring(11, 19);
  } catch {
    return iso;
  }
}
