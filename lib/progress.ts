import { createClient } from '@/lib/supabase/server'
import { LEVELS, today } from '@/lib/game'

export async function getProgress() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: p }, { data: days }] = await Promise.all([
    supabase.from('profiles')
      .select('display_name, current_streak, longest_streak, last_streak_date, streak_freezes')
      .eq('id', user.id).single(),
    supabase.from('daily_scores')
      .select('topic_id, points, questions_answered, levels_cleared')
      .eq('user_id', user.id).eq('play_date', today()),
  ])

  // Same rule as the old liveStreak(): the streak survives a 1-day gap, or a 2-day gap with a freeze
  const gap = p?.last_streak_date
    ? Math.round((Date.parse(today()) - Date.parse(p.last_streak_date)) / 864e5)
    : null
  const streak = p && gap !== null && (gap <= 1 || (gap === 2 && p.streak_freezes > 0)) ? p.current_streak : 0

  return {
    name: p?.display_name,
    streak,
    freezes: p?.streak_freezes ?? 0,
    longest: p?.longest_streak ?? 0,
    byTopic: Object.fromEntries((days ?? []).map((d) => [d.topic_id, d])), // today's progress per topic
  }
}

/** The first level not yet cleared today for this topic (0 = beginner). */
export async function getStartLevel(topic: string): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { data } = await supabase.from('daily_scores')
    .select('levels_cleared')
    .eq('user_id', user.id).eq('topic_id', topic).eq('play_date', today())
    .maybeSingle()

  const cleared: string[] = data?.levels_cleared ?? []
  const next = LEVELS.findIndex((l) => !cleared.includes(l))
  return next === -1 ? 0 : next // all three cleared: start over from beginner
}