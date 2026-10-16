"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LEVELS, PASS, SECONDS, TOPICS, type Feedback, type Question, type RoundResult } from "@/lib/game";
import { finishRound, nextQuestion, startRound, submitAnswer } from "@/lib/quiz";

const primaryBtn = "cursor-pointer rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 font-bold text-white shadow-lg shadow-fuchsia-950/30 transition motion-reduce:transition-none hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fuchsia-300 disabled:opacity-60";
const ghostBtn = "cursor-pointer rounded-xl px-4 py-3 font-semibold text-slate-300 transition motion-reduce:transition-none hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300";

const Shell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-[#000000] font-sans text-slate-100 antialiased selection:bg-fuchsia-400/30">
    <div className="relative mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6 sm:py-12">{children}</div>
  </div>
);

export default function Quiz({ topic }: { topic: string }) {
  const [li, setLi] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [picked, setPicked] = useState<number | null>(null); // -1 = timed out
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [left, setLeft] = useState(SECONDS); // display only; the server measures the real time
  const [res, setRes] = useState<RoundResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const started = useRef(false);
  const level = LEVELS[li];

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(false);
    try { await fn(); } catch { setError(true); } finally { setBusy(false); }
  }

  const start = (l: number) => run(async () => {
    setLi(l); setQuestion(null); setRes(null); setPicked(null); setFeedback(null);
    const r = await startRound(topic, LEVELS[l]);
    setAttemptId(r.attemptId); setQuestion(r.question); setLeft(SECONDS);
  });

  useEffect(() => {
    if (started.current) return; // stops React dev mode from starting two rounds
    started.current = true;
    start(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(choice: number | null) {
    if (!question || !attemptId || picked !== null) return;
    setPicked(choice ?? -1);
    try { setFeedback(await submitAnswer(attemptId, question.position, choice)); }
    catch { setError(true); }
  }

  useEffect(() => {
    if (!question || picked !== null) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const l = SECONDS - (Date.now() - t0) / 1000;
      if (l <= 0) { clearInterval(id); setLeft(0); submit(null); } else setLeft(l);
    }, 100);
    return () => clearInterval(id);
  }, [question, picked]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => run(async () => {
    if (!attemptId || !question) return;
    if (question.position < 4) {
      const q = await nextQuestion(attemptId);
      setQuestion(q); setPicked(null); setFeedback(null); setLeft(SECONDS);
    } else {
      setRes(await finishRound(attemptId));
    }
  });

  const t = TOPICS[topic];

  if (error) return (
    <Shell>
      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5 text-slate-300">
        <p className="mb-4">Something went wrong.</p>
        <button onClick={() => start(li)} className={primaryBtn}>Restart this level</button>
        <Link href="/" className={`${ghostBtn} ml-2 inline-block`}>Back home</Link>
      </div>
    </Shell>
  );

  if (!question) return <Shell><p className="rounded-xl border border-slate-700 bg-slate-900/70 p-5 text-slate-300">Loading your questions…</p></Shell>;

  if (res) {
    const last = li === 2;
    return (
      <Shell>
        <div className="mt-8 rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 text-center shadow-2xl shadow-black/30 backdrop-blur sm:p-10">
          <span aria-hidden="true" className={`mx-auto mb-4 grid size-16 place-items-center rounded-2xl text-3xl ${res.passed ? "bg-emerald-300/10 text-emerald-200 ring-1 ring-emerald-300/30" : "bg-rose-300/10 text-rose-200 ring-1 ring-rose-300/30"}`}>{res.passed ? "🎉" : "💪"}</span>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{res.passed ? (last ? "Topic cleared!" : "Level cleared!") : "Not this time"}</h2>
          <p className="my-3 bg-gradient-to-r from-fuchsia-300 to-cyan-300 bg-clip-text text-6xl font-black tracking-tight text-transparent">{res.correct}/5</p>
          <p className="text-sm text-slate-400">Needed {PASS[level]} of 5 · {res.points} points this round</p>
          {res.passed && last && <p className="mt-4 font-semibold text-amber-200">🔥 Streak: {res.streak} {res.streak === 1 ? "day" : "days"}</p>}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {res.passed && !last && <button onClick={() => start(li + 1)} disabled={busy} className={primaryBtn}>Start {LEVELS[li + 1]}</button>}
            {!res.passed && <button onClick={() => start(li)} disabled={busy} className={primaryBtn}>Retry with new questions</button>}
            <Link href="/" className={ghostBtn}>{res.passed && last ? "Pick another topic" : "Back home"}</Link>
          </div>
        </div>
      </Shell>
    );
  }

  const answered = picked !== null;
  const optionClass = (k: number) => {
    if (!answered) return "border-slate-700 bg-slate-900/70 text-slate-200 hover:border-violet-300/70 hover:bg-violet-300/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300";
    if (!feedback) return k === picked ? "border-violet-300/70 bg-violet-300/10 text-violet-100" : "border-slate-800 bg-slate-900/40 text-slate-500 opacity-60"; // waiting for the server
    if (k === feedback.correctIndex) return "border-emerald-300/70 bg-emerald-300/10 text-emerald-100";
    if (k === picked) return "border-rose-300/70 bg-rose-300/10 text-rose-100";
    return "border-slate-800 bg-slate-900/40 text-slate-500 opacity-60";
  };

  return (
    <Shell>
      <header className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/70 px-4 py-3 backdrop-blur">
        <Link href="/" className="grid size-10 shrink-0 place-items-center rounded-xl text-xl text-slate-300 transition motion-reduce:transition-none hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" aria-label="Back home">←</Link>
        <span className="truncate text-sm font-medium text-slate-200 sm:text-base">{t.icon} {t.name} <span className="text-slate-500">·</span> <b className="text-cyan-200">{level}</b></span>
        <span className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1 text-sm font-bold tabular-nums text-slate-300">{question.position + 1}<span className="text-slate-500">/5</span></span>
      </header>
      <div className="mb-8 h-2.5 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5" role="timer" aria-label={`${Math.ceil(left)} seconds left`}>
        <div style={{ width: `${(left / SECONDS) * 100}%` }} className={`h-full rounded-full transition-[width] duration-100 motion-reduce:transition-none ${left < 5 ? "bg-gradient-to-r from-amber-300 to-rose-400" : "bg-gradient-to-r from-cyan-300 via-violet-400 to-fuchsia-400"}`} />
      </div>
      <h2 className="mb-6 text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl">{question.question}</h2>
      <div className="grid gap-3">
        {question.options.map((o, k) => (
          <button key={k} disabled={answered} onClick={() => submit(k)}
            className={`w-full cursor-pointer rounded-xl border px-4 py-4 text-left text-base font-medium transition duration-150 motion-reduce:transition-none disabled:cursor-default sm:px-5 ${optionClass(k)}`}>{o}</button>
        ))}
      </div>
      {feedback && (
        <div className={`mt-5 grid gap-3 rounded-2xl border p-5 ${feedback.isCorrect ? "border-emerald-300/30 bg-emerald-300/5" : "border-amber-300/30 bg-amber-300/5"}`}>
          <strong className={feedback.isCorrect ? "text-emerald-200" : "text-amber-200"}>{feedback.isCorrect ? "Correct!" : feedback.timedOut ? "Time's up" : "Not quite"}</strong>
          <p className="m-0 leading-7 text-slate-300">{feedback.explanation}</p>
          <button onClick={next} disabled={busy} className={`${primaryBtn} justify-self-start`}>{question.position < 4 ? "Next question" : "See result"}</button>
        </div>
      )}
    </Shell>
  );
}