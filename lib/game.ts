export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];
export const PASS: Record<Level, number> = { beginner: 4, intermediate: 4, advanced: 3 }; // display only; the real rule is in finish_attempt (SQL), keep them in sync
export const SECONDS = 15;
export const TOPICS: Record<string, { name: string; icon: string; blurb: string }> = {
  physics: { name: "Physics", icon: "⚛️", blurb: "Forces, waves, light" },
  history: { name: "History", icon: "🏛️", blurb: "Empires, wars, revolutions" },
  geography: { name: "Geography", icon: "🌍", blurb: "Capitals, rivers, peaks" },
};

// What the server sends the browser: never the correct answer until the player has answered.
export type Question = { position: number; question: string; options: string[] };
export type Feedback = { isCorrect: boolean; timedOut: boolean; correctIndex: number; explanation: string | null; points: number };
export type RoundResult = { correct: number; points: number; passed: boolean; streak: number; topicCleared: boolean };

/** 100 for a correct answer plus up to 50 for speed. */
export const score = (secondsLeft: number) =>
  100 + Math.round((50 * Math.min(SECONDS, Math.max(0, secondsLeft))) / SECONDS);

/** The game day (UTC, matching Postgres current_date). */
export const today = () => new Date().toISOString().slice(0, 10);