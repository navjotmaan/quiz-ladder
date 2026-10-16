import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

// Not importing lib/supabase/admin.ts: its `server-only` import throws outside Next.js
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const hash = (s: string) =>
  createHash('sha256').update(s.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex')

async function main() {
  const data = JSON.parse(readFileSync('data/questions.json', 'utf8'))
  const rows: any[] = []
  for (const [topic, levels] of Object.entries<any>(data))
    for (const [level, qs] of Object.entries<any>(levels))
      for (const q of qs)
        rows.push({
          topic_id: topic, level, question: q.q, options: q.o,
          correct_index: q.a, explanation: q.e, source: 'seed', content_hash: hash(q.q),
        })

  const { error } = await supabase
    .from('questions')
    .upsert(rows, { onConflict: 'topic_id,content_hash', ignoreDuplicates: true })
  if (error) throw error
  console.log(`Seeded ${rows.length} questions`)
}
main()