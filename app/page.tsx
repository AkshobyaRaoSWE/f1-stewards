import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { IncidentsFile } from "./lib/incidents";
import { Shell } from "./components/Shell";

async function load(): Promise<IncidentsFile | null> {
  try {
    const p = join(process.cwd(), "public/incidents.json");
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return null;
  }
}

export default async function Home() {
  const data = await load();
  if (!data) {
    return (
      <div className="min-h-screen grid place-items-center text-white/60 font-display tracking-widest uppercase text-sm text-center px-6">
        <div>
          No data yet. Run{" "}
          <code className="font-mono ml-2 mr-2 px-2 py-1 bg-white/5 rounded">
            node scripts/fetch.mjs
          </code>{" "}
          to bake the incidents file.
        </div>
      </div>
    );
  }
  const totalCases = data.sessions.reduce((n, s) => n + s.cases.length, 0);
  const years = [
    ...new Set(data.sessions.map((s) => s.year)),
  ].sort();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="relative border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(225,37,44,0.18),transparent_50%)] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 py-4 flex items-baseline justify-between gap-6 flex-wrap">
          <div>
            <div className="font-display text-xs tracking-[0.4em] uppercase text-white/40">
              FIA Stewards
            </div>
            <h1 className="font-display text-2xl text-white tracking-tight">
              Decision Log{" "}
              <span className="text-white/40">/ {years.join(" · ")}</span>
            </h1>
          </div>
          <div className="flex items-baseline gap-6 text-xs">
            <Stat label="Sessions" value={data.sessions.length} />
            <Stat label="Cases" value={totalCases} />
            <Stat label="Generated" value={new Date(data.generated).toLocaleDateString()} />
          </div>
        </div>
      </header>
      <Shell data={data} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40">
        {label}
      </div>
      <div className="font-display text-base tabular-nums text-white">
        {value}
      </div>
    </div>
  );
}
