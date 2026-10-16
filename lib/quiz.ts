'use server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin as db } from '@/lib/supabase/admin'
import { LEVELS, SECONDS, score, today, type Feedback, type Level, type Question, type RoundResult } from '@/lib/game'

const GRACE = 2 // seconds of network slack on top of the 15s timer

// Every action starts here. The user id comes from the verified session, never from the browser.
async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  return user
}

async function ownAttempt(userId: string, attemptId: string) {
  const { data, error } = await db
    .from('attempts')
    .select('id, topic_id, level, play_date')
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
async function serveQuestion(a: { id: string; topic_id: string; level: string }): Promise<Question | null> {
    const { data, error } = await db
    .from('attempt_answers')
    .select('position, question_id, answered_at, option_order, questions(question, options)')
    .eq('attempt_id', a.id)
    .order('position')
  if (error) throw error
  const rows = (data ?? []) as any[]

  // A question is already open: return it without resetting its clock.
  const open = rows.find((r: any) => !r.answered_at)
  if (open) return present(open.position, open.questions.question, open.questions.options, open.option_order)
  if (rows.length >= 5) return null

  const used = rows.map((r: any) => r.question_id)
  const { data: pool, error: poolErr } = await db
    .from('questions').select('id, question, options')
    .eq('topic_id', a.topic_id).eq('level', a.level).eq('status', 'active')
  if (poolErr) throw poolErr
  const fresh = pool.filter((q: any) => !used.includes(q.id))
  if (!fresh.length) throw new Error('Not enough questions for this level')

  const pick = fresh[Math.floor(Math.random() * fresh.length)]
  const order = shuffle([0, 1, 2, 3])
  const { error: insErr } = await db.from('attempt_answers').insert({
    attempt_id: a.id, position: rows.length, question_id: pick.id,
    option_order: order, shown_at: new Date().toISOString(),
  })
  if (insErr) throw insErr
  return present(rows.length, pick.question, pick.options, order)
}

export async function startRound(topic: string, level: Level) {
  const user = await requireUser()
  const li = LEVELS.indexOf(level)
  if (li < 0) throw new Error('Bad level')

  // Must clear the previous level today before starting this one.
  if (li > 0) {
    const { data } = await db.from('daily_scores').select('levels_cleared')
      .eq('user_id', user.id).eq('topic_id', topic).eq('play_date', today()).maybeSingle()
    if (!data?.levels_cleared?.includes(LEVELS[li - 1])) throw new Error('Clear the previous level first')
  }

  const { data: attempt, error } = await db.from('attempts')
    .insert({ user_id: user.id, topic_id: topic, level })
    .select('id, topic_id, level').single()
  if (error) throw error

  const question = await serveQuestion(attempt)
  return { attemptId: attempt.id as string, question: question! }
}

export async function nextQuestion(attemptId: string): Promise<Question> {
  const user = await requireUser()
  const attempt = await ownAttempt(user.id, attemptId)
  const q = await serveQuestion(attempt)
  if (!q) throw new Error('Round already complete')
  return q
}

export async function submitAnswer(attemptId: string, position: number, chosen: number | null): Promise<Feedback> {
  const user = await requireUser()
  if (chosen !== null && !(Number.isInteger(chosen) && chosen >= 0 && chosen <= 3)) throw new Error('Bad choice')
  await ownAttempt(user.id, attemptId)

  const { data: row, error } = await db.from('attempt_answers')
    .select('shown_at, option_order, questions(correct_index, explanation)')
    .eq('attempt_id', attemptId).eq('position', position).is('answered_at', null)
    .single()
  if (error || !row) throw new Error('Already answered')

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
      chosen_index: timedOut ? null : chosen, // chosen_index = the position the player saw
      is_correct: isCorrect, points,
    })
    .eq('attempt_id', attemptId).eq('position', position).is('answered_at', null)
    .select('position')
  if (upErr) throw upErr
  if (!updated?.length) throw new Error('Already answered')

  return { isCorrect, timedOut, correctIndex: order.indexOf(q.correct_index), explanation: q.explanation, points }
}

export async function finishRound(attemptId: string): Promise<RoundResult> {
  const user = await requireUser()
  const { data: attempt } = await db.from('attempts')
    .select('id, topic_id, play_date, finished_at')
    .eq('id', attemptId).eq('user_id', user.id).single()
  if (!attempt) throw new Error('Round not found')

  if (!attempt.finished_at) {
    const { count } = await db.from('attempt_answers').select('*', { count: 'exact', head: true })
      .eq('attempt_id', attemptId).not('answered_at', 'is', null)
    if (count !== 5) throw new Error('Round not complete')
    const { error } = await db.rpc('finish_attempt', { p_attempt: attemptId }) // grades, updates daily_scores and streak atomically
    if (error) throw error
  }

  const [{ data: done }, { data: profile }, { data: day }] = await Promise.all([
    db.from('attempts').select('correct_count, points, passed').eq('id', attemptId).single(),
    db.from('profiles').select('current_streak').eq('id', user.id).single(),
    db.from('daily_scores').select('levels_cleared')
      .eq('user_id', user.id).eq('topic_id', attempt.topic_id).eq('play_date', attempt.play_date).single(),
  ])
  return {
    correct: done!.correct_count, points: done!.points, passed: done!.passed,
    streak: profile!.current_streak, topicCleared: day!.levels_cleared.length === 3,
  }
}