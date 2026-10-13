const KEY = "quizladder-v1";
export type TopicDay = { points: number; answered: number; cleared: string[] };
type Streak = { count: number; last: string; freezes: number };
type State = { streak: Streak; days: Record<string, Record<string, TopicDay>>; rounds: Record<string, number> };

const empty = (): State => ({ streak: { count: 0, last: "", freezes: 0 }, days: {}, rounds: {} });

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const gap = (a: string, b: string) => Math.round((+new Date(b) - +new Date(a)) / 864e5);

export function load(): State {
  try { return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return empty(); }
}

const save = (s: State) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

/** Which 5-question set to serve next. Increments every time a round starts, so retries get fresh questions. */
export function nextRoundIndex(topic: string, level: string): number {
  const s = load(), k = `${topic}:${level}`, n = s.rounds[k] || 0;
  s.rounds[k] = n + 1; save(s); return n;
}

/** Streak shown to the user (0 if it has lapsed beyond what a freeze can cover). */
export function liveStreak(s: Streak): number {
  if (!s.last) return 0;
  const g = gap(s.last, today());
  return g <= 1 || (g === 2 && s.freezes > 0) ? s.count : 0;
}

export function recordRound(topic: string, level: string, points: number, passed: boolean) {
  const s = load(), t0 = today();
  const t = ((s.days[t0] ||= {})[topic] ||= { points: 0, answered: 0, cleared: [] });
  t.points += points; t.answered += 5;
  if (passed && !t.cleared.includes(level)) t.cleared.push(level);
  const st = s.streak;
  if (t.cleared.length === 3 && st.last !== t0) {
    const g = st.last ? gap(st.last, t0) : 99;
    if (g === 1) st.count++;
    else if (g === 2 && st.freezes > 0) { st.freezes--; st.count++; }
    else st.count = 1;
    st.last = t0;
    if (st.count % 7 === 0) st.freezes = Math.min(1, st.freezes + 1);
  }
  save(s);
  return { streak: liveStreak(st), topicCleared: t.cleared.length === 3 };
}
