import data from "@/data/questions.json";
import { nextRoundIndex } from "./storage";

export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];
export const PASS: Record<Level, number> = { beginner: 4, intermediate: 4, advanced: 3 };
export const SECONDS = 15;
export const TOPICS: Record<string, { name: string; icon: string; blurb: string }> = {
  physics: { name: "Physics", icon: "⚛️", blurb: "Forces, waves, light" },
  history: { name: "History", icon: "🏛️", blurb: "Empires, wars, revolutions" },
  geography: { name: "Geography", icon: "🌍", blurb: "Capitals, rivers, peaks" },
};
export type Q = { q: string; o: string[]; a: number; e: string };

const shuffle = <T,>(a: T[]) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

/** 5 questions for a level. Cycles through the stored sets so a retry gets new ones; options are shuffled. */
export function getRound(topic: string, level: Level): Q[] {
  const pool = (data as any)[topic][level] as Q[];
  const sets = Math.max(1, Math.floor(pool.length / 5));
  const start = (nextRoundIndex(topic, level) % sets) * 5;
  return shuffle(pool.slice(start, start + 5)).map((q) => {
    const order = shuffle(q.o.map((_, i) => i));
    return { ...q, o: order.map((i) => q.o[i]), a: order.indexOf(q.a) };
  });
}

/** 100 for a correct answer plus up to 50 for speed. Timeouts and wrong answers score 0. */
export const score = (secondsLeft: number) => 100 + Math.round(50 * Math.max(0, secondsLeft) / SECONDS);
