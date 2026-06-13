"use client";

import { useMemo, useState } from "react";
import { flatten, type IncidentsFile } from "../lib/incidents";
import { CaseList } from "./CaseList";
import { DriversView } from "./DriversView";

type View = "cases" | "drivers";

export function Shell({ data }: { data: IncidentsFile }) {
  const allRows = useMemo(() => flatten(data), [data]);
  const allYears = useMemo(() => {
    const s = new Set<number>();
    for (const r of allRows) s.add(r.session.year);
    return [...s].sort();
  }, [allRows]);

  const defaultYear = allYears[allYears.length - 1] ?? null;
  const [view, setView] = useState<View>("cases");
  const [year, setYear] = useState<number | "all">(defaultYear ?? "all");

  const rows = useMemo(
    () => (year === "all" ? allRows : allRows.filter((r) => r.session.year === year)),
    [allRows, year],
  );

  return (
    <>
      <div className="px-6 pt-4 pb-3 border-b border-white/5 flex flex-wrap items-center gap-3 bg-black">
        <div className="flex bg-zinc-900 border border-white/10 rounded-md p-0.5">
          {(["cases", "drivers"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-[10px] font-display tracking-[0.3em] uppercase rounded transition ${
                view === v ? "bg-white text-black" : "text-white/50 hover:text-white"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex bg-zinc-900 border border-white/10 rounded-md p-0.5">
          {([...allYears, "all"] as (number | "all")[]).map((y) => (
            <button
              key={String(y)}
              onClick={() => setYear(y)}
              className={`px-3 py-1.5 text-[10px] font-display tracking-[0.2em] uppercase rounded transition tabular-nums ${
                year === y ? "bg-white text-black" : "text-white/50 hover:text-white"
              }`}
            >
              {y === "all" ? "All" : y}
            </button>
          ))}
        </div>

        <div className="ml-auto text-[10px] font-display tracking-[0.3em] uppercase text-white/40 tabular-nums">
          {rows.length} cases · {new Set(rows.map((r) => r.session.key)).size} sessions
        </div>
      </div>

      {view === "cases" ? <CaseList rows={rows} /> : <DriversView rows={rows} />}
    </>
  );
}
