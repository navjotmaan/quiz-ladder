"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LEVELS, PASS, SECONDS, TOPICS, getRound, score, type Q } from "@/lib/game";
import { recordRound } from "@/lib/storage";

export default function Quiz({ topic }: { topic: string }) {
  const [li, setLi] = useState(0);
  const [qs, setQs] = useState<Q[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // -1 = timed out
  const [left, setLeft] = useState(SECONDS);
  const [right, setRight] = useState(0);
  const [pts, setPts] = useState(0);
  const [done, setDone] = useState(false);
  const [res, setRes] = useState({ streak: 0, topicCleared: false });
  const leftRef = useRef(SECONDS);
  const level = LEVELS[li];

  function start(l: number) {
    setLi(l); setQs(getRound(topic, LEVELS[l]));
    setI(0); setPicked(null); setLeft(SECONDS); setRight(0); setPts(0); setDone(false);
  }
  useEffect(() => start(0), []); // eslint-disable-line react-hooks/exhaustive-deps

  function answer(choice: number, secs: number) {
    setPicked(choice);
    if (choice === qs[i].a) { setRight((r) => r + 1); setPts((p) => p + score(secs)); }
  }

  useEffect(() => {
    if (done || picked !== null || !qs.length) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const l = SECONDS - (Date.now() - t0) / 1000;
      leftRef.current = l;
      if (l <= 0) { clearInterval(id); setLeft(0); answer(-1, 0); } else setLeft(l);
    }, 100);
    return () => clearInterval(id);
  }, [i, picked, qs, done]); // eslint-disable-line react-hooks/exhaustive-deps

  function next() {
    if (i < 4) { setI(i + 1); setPicked(null); setLeft(SECONDS); leftRef.current = SECONDS; return; }
    setRes(recordRound(topic, level, pts, right >= PASS[level]));
    setDone(true);
  }

  const t = TOPICS[topic];
  if (!qs.length) return <p className="rounded-xl border border-slate-700 bg-slate-900/70 p-5 text-slate-300">Loading your questions…</p>;

  if (done) {
    const passed = right >= PASS[level], last = li === 2;
    return (
      <div className="mt-8 rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 text-center shadow-2xl shadow-black/30 backdrop-blur sm:p-10">
        <span aria-hidden="true" className={`mx-auto mb-4 grid size-16 place-items-center rounded-2xl text-3xl ${passed ? "bg-emerald-300/10 text-emerald-200 ring-1 ring-emerald-300/30" : "bg-rose-300/10 text-rose-200 ring-1 ring-rose-300/30"}`}>{passed ? "🎉" : "💪"}</span>
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{passed ? (last ? "Topic cleared!" : "Level cleared!") : "Not this time"}</h2>
        <p className="my-3 bg-gradient-to-r from-fuchsia-300 to-cyan-300 bg-clip-text text-6xl font-black tracking-tight text-transparent">{right}/5</p>
        <p className="text-sm text-slate-400">Needed {PASS[level]} of 5 · {pts} points this round</p>
        {passed && last && <p className="mt-4 font-semibold text-amber-200">🔥 Streak: {res.streak} {res.streak === 1 ? "day" : "days"}</p>}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {passed && !last && <button onClick={() => start(li + 1)} className="cursor-pointer rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 font-bold text-white shadow-lg shadow-fuchsia-950/30 transition motion-reduce:transition-none hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fuchsia-300">Start {LEVELS[li + 1]}</button>}
          {!passed && <button onClick={() => start(li)} className="cursor-pointer rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 font-bold text-white shadow-lg shadow-fuchsia-950/30 transition motion-reduce:transition-none hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fuchsia-300">Retry with new questions</button>}
          <Link href="/" className="cursor-pointer rounded-xl px-4 py-3 font-semibold text-slate-300 transition motion-reduce:transition-none hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">{passed && last ? "Pick another topic" : "Back home"}</Link>
        </div>
      </div>
    );
  }

  const q = qs[i], answered = picked !== null;
  return (
    <>
      <header className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/70 px-4 py-3 backdrop-blur">
        <Link href="/" className="grid size-10 shrink-0 place-items-center rounded-xl text-xl text-slate-300 transition motion-reduce:transition-none hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" aria-label="Back home">←</Link>
        <span className="truncate text-sm font-medium text-slate-200 sm:text-base">{t.icon} {t.name} <span className="text-slate-500">·</span> <b className="text-cyan-200">{level}</b></span>
        <span className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1 text-sm font-bold tabular-nums text-slate-300">{i + 1}<span className="text-slate-500">/5</span></span>
      </header>
      <div className="mb-8 h-2.5 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5" role="timer" aria-label={`${Math.ceil(left)} seconds left`}>
        <div style={{ width: `${(left / SECONDS) * 100}%` }} className={`h-full rounded-full transition-[width] duration-100 motion-reduce:transition-none ${left < 5 ? "bg-gradient-to-r from-amber-300 to-rose-400" : "bg-gradient-to-r from-cyan-300 via-violet-400 to-fuchsia-400"}`} />
      </div>
      <h2 className="mb-6 text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl">{q.q}</h2>
      <div className="grid gap-3">
        {q.o.map((o, k) => (
          <button key={k} disabled={answered} onClick={() => answer(k, leftRef.current)}
            className={`w-full cursor-pointer rounded-xl border px-4 py-4 text-left text-base font-medium transition duration-150 motion-reduce:transition-none disabled:cursor-default sm:px-5 ${!answered ? "border-slate-700 bg-slate-900/70 text-slate-200 hover:border-violet-300/70 hover:bg-violet-300/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300" : k === q.a ? "border-emerald-300/70 bg-emerald-300/10 text-emerald-100" : k === picked ? "border-rose-300/70 bg-rose-300/10 text-rose-100" : "border-slate-800 bg-slate-900/40 text-slate-500 opacity-60"}`}>{o}</button>
        ))}
      </div>
      {answered && (
        <div className={`mt-5 grid gap-3 rounded-2xl border p-5 ${picked === q.a ? "border-emerald-300/30 bg-emerald-300/5" : "border-amber-300/30 bg-amber-300/5"}`}>
          <strong className={picked === q.a ? "text-emerald-200" : "text-amber-200"}>{picked === q.a ? "Correct!" : picked === -1 ? "Time's up" : "Not quite"}</strong>
          <p className="m-0 leading-7 text-slate-300">{q.e}</p>
          <button onClick={next} className="cursor-pointer justify-self-start rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 font-bold text-white shadow-lg shadow-fuchsia-950/30 transition motion-reduce:transition-none hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fuchsia-300">{i < 4 ? "Next question" : "See result"}</button>
        </div>
      )}
    </>
  );
}
