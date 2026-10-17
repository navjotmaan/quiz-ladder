'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin as db } from '@/lib/supabase/admin'
import { LEVELS, SECONDS, score, today, type Feedback, type Level, type Question, type RoundResult } from '@/lib/game'

const GRACE = 2 // seconds of network slack on top of the 15s timer

// Every action starts here. The id comes from the verified session token, never from the browser.
// getClaims() checks the token locally, so there is no extra network call to Supabase Auth.
async function requireUserId() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const id = data?.claims?.sub
  if (!id) throw new Error('Not signed in')
  return id
}

async function ownAttempt(userId: string, attemptId: string) {
  const { data, error } = await db
    .from('attempts')
    .select('id, topic_id, level')
    .eq('id', attemptId).eq('user_id', userId).is('finished_at', null)
    .single()
  if (error || !data) throw new Error('Round not found')
  return data
}

const shuffle = <T,>(a: T[]) => {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

const present = (position: number, question: string, options: string[], order: number[]): Question => ({
  position, question, options: order.map((i) => options[i]),
})

/** Shows the round's next question: re-sends the open one, or picks and records a new one. */
async function serveQuestion(
  a: { id: string; topic_id: string; level: string },
  isNew = false, // a brand-new attempt has no answers yet, so skip that query
): Promise<Question | null> {
  // The existing answers and the question pool don't depend on each other: fetch them together
  const [rowsRes, poolRes] = await Promise.all([
    isNew
      ? Promise.resolve({ data: [] as any[], error: null })
      : db.from('attempt_answers')
          .select('position, question_id, answered_at, option_order, questions(question, options)')
          .eq('attempt_id', a.id).order('position'),
    db.from('questions').select('id, question, options')
      .eq('topic_id', a.topic_id).eq('level', a.level).eq('status', 'active'),
  ])
  if (rowsRes.error) throw rowsRes.error
  if (poolRes.error) throw poolRes.error
  const rows = (rowsRes.data ?? []) as any[]
  const pool = (poolRes.data ?? []) as any[]

  // A question is already open: return it without resetting its clock.
  const open = rows.find((r) => !r.answered_at)
  if (open) return present(open.position, open.questions.question, open.questions.options, open.option_order)
  if (rows.length >= 5) return null

  const used = new Set(rows.map((r) => r.question_id))
  const unused = pool.filter((q) => !used.has(q.id))
  if (!unused.length) throw new Error('Not enough questions for this level')

  const pick = unused[Math.floor(Math.random() * unused.length)]
  const order = shuffle([0, 1, 2, 3])
  const { error } = await db.from('attempt_answers').insert({
    attempt_id: a.id, position: rows.length, question_id: pick.id,
    option_order: order, shown_at: new Date().toISOString(),
  })
  if (error) throw error
  return present(rows.length, pick.question, pick.options, order)
}

export async function startRound(topic: string, level: Level) {
  const userId = await requireUserId()
  const li = LEVELS.indexOf(level)
  if (li < 0) throw new Error('Bad level')

  // Must clear the previous level today before starting this one.
  if (li > 0) {
    const { data } = await db.from('daily_scores').select('levels_cleared')
      .eq('user_id', userId).eq('topic_id', topic).eq('play_date', today()).maybeSingle()
    if (!data?.levels_cleared?.includes(LEVELS[li - 1])) throw new Error('Clear the previous level first')
  }

  const { data: attempt, error } = await db.from('attempts')
    .insert({ user_id: userId, topic_id: topic, level })
    .select('id, topic_id, level').single()
  if (error) throw error

  const question = await serveQuestion(attempt, true)
  return { attemptId: attempt.id as string, question: question! }
}

export async function nextQuestion(attemptId: string): Promise<Question> {
  const userId = await requireUserId()
  const attempt = await ownAttempt(userId, attemptId)
  const q = await serveQuestion(attempt)
  if (!q) throw new Error('Round already complete')
  return q
}

export async function submitAnswer(attemptId: string, position: number, chosen: number | null): Promise<Feedback> {
  const userId = await requireUserId()
  if (chosen !== null && !(Number.isInteger(chosen) && chosen >= 0 && chosen <= 3)) throw new Error('Bad choice')

  // One query does three jobs: finds the open answer row, joins its question, and proves
  // the attempt belongs to this user and is unfinished (the !inner join filters on attempts).
  const { data: row, error } = await db.from('attempt_answers')
    .select('shown_at, option_order, questions(correct_index, explanation), attempts!inner(user_id, finished_at)')
    .eq('attempt_id', attemptId).eq('position', position)
    .eq('attempts.user_id', userId).is('attempts.finished_at', null)
    .is('answered_at', null)
    .single()
  if (error || !row) throw new Error('Already answered or round not found')

  const q = row.questions as unknown as { correct_index: number; explanation: string | null }
  const order = row.option_order as number[]
  const now = Date.now()
  const elapsed = (now - Date.parse(row.shown_at)) / 1000 // the server's clock decides, not the browser's
  const timedOut = chosen === null || elapsed > SECONDS + GRACE
  const isCorrect = !timedOut && order[chosen!] === q.correct_index
  const points = isCorrect ? score(SECONDS - elapsed) : 0

  // `answered_at is null` makes a double-click or replayed request a no-op
  const { data: updated, error: upErr } = await db.from('attempt_answers')
    .update({
      answered_at: new Date(now).toISOString(),
      chosen_index: timedOut ? null : chosen,
      is_correct: isCorrect, points,
    })
    .eq('attempt_id', attemptId).eq('position', position).is('answered_at', null)
    .select('position')
  if (upErr) throw upErr
  if (!updated?.length) throw new Error('Already answered')

  return { isCorrect, timedOut, correctIndex: order.indexOf(q.correct_index), explanation: q.explanation, points }
}

export async function finishRound(attemptId: string): Promise<RoundResult> {
  const userId = await requireUserId()

  const [{ data: attempt }, { count }] = await Promise.all([
    db.from('attempts')
      .select('topic_id, play_date, finished_at, correct_count, points, passed')
      .eq('id', attemptId).eq('user_id', userId).single(),
    db.from('attempt_answers').select('*', { count: 'exact', head: true })
      .eq('attempt_id', attemptId).not('answered_at', 'is', null),
  ])
  if (!attempt) throw new Error('Round not found')

  let done: { correct_count: number; points: number; passed: boolean } = attempt
  if (!attempt.finished_at) {
    if (count !== 5) throw new Error('Round not complete')
    const { data, error } = await db.rpc('finish_attempt', { p_attempt: attemptId }) // grades, updates daily_scores and streak atomically
    if (error) throw error
    done = Array.isArray(data) ? data[0] : data // the function returns the finished attempt row
    revalidatePath('/dashboard') // drops the browser's cached pages so the dashboard shows the new streak and levels
  }

  const [{ data: profile }, { data: day }] = await Promise.all([
    db.from('profiles').select('current_streak').eq('id', userId).single(),
    db.from('daily_scores').select('levels_cleared')
      .eq('user_id', userId).eq('topic_id', attempt.topic_id).eq('play_date', attempt.play_date).single(),
  ])
  return {
    correct: done.correct_count, points: done.points, passed: done.passed,
    streak: profile!.current_streak, topicCleared: day!.levels_cleared.length === 3,
  }
}