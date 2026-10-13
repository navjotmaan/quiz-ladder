"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LEVELS, TOPICS } from "@/lib/game";
import { load, liveStreak, today } from "@/lib/storage";

export default function Home() {
  const [s, setS] = useState<ReturnType<typeof load> | null>(null);
  useEffect(() => setS(load()), []);
  const day = s?.days[today()] ?? {};
  return (
    <>
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Your daily brain workout</p>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Quiz <span className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">Ladder</span>
          </h1>
        </div>
        <div aria-label="Current streak" className="shrink-0 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-right shadow-lg shadow-amber-950/20 sm:px-4">
          <div className="text-lg font-extrabold text-amber-200 sm:text-xl">🔥 {s ? liveStreak(s.streak) : 0}</div>
          <small className="block text-xs text-amber-100/65">{s && s.streak.freezes > 0 ? "1 freeze ready" : "day streak"}</small>
        </div>
      </header>
      <p className="mb-7 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
        Pick a topic, climb all three levels, and keep your streak glowing.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(TOPICS).map(([id, t]) => {
          const d = day[id];
          const avg = d && d.answered ? Math.round(d.points / d.answered) : null;
          return (
            <Link
              key={id}
              href={`/play/${id}`}
              className="group flex min-h-56 flex-col rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-xl shadow-black/20 backdrop-blur transition duration-200 motion-reduce:transition-none hover:-translate-y-1 hover:border-cyan-300/50 hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
            >
              <span className="mb-4 grid size-12 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-400/20 to-cyan-300/20 text-3xl ring-1 ring-white/10 transition motion-reduce:transition-none group-hover:scale-105">{t.icon}</span>
              <strong className="text-lg font-bold text-white">{t.name}</strong>
              <span className="mt-1 text-sm leading-6 text-slate-400">{t.blurb}</span>
              <span aria-label={`${d?.cleared.length ?? 0} of 3 levels cleared`} className="mt-auto flex gap-1.5 pt-5">
                {LEVELS.map((l) => <i key={l} className={`h-1.5 w-8 rounded-full ${d?.cleared.includes(l) ? "bg-emerald-300 shadow-[0_0_10px_#6ee7b7]" : "bg-slate-700"}`} title={l} />)}
              </span>
              <span className="mt-2 text-xs text-slate-500">{avg === null ? "Not played today" : `Today's average: ${avg} pts/question`}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
