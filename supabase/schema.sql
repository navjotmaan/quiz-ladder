-- Quiz Ladder: full database schema.
-- Run this once in Supabase Dashboard -> SQL Editor on a fresh project.

create type level as enum ('beginner', 'intermediate', 'advanced');
create type question_source as enum ('seed', 'ai');
create type question_status as enum ('active', 'flagged', 'removed');

-- ───────── users ─────────
create table profiles (
  id               uuid primary key references auth.users on delete cascade,
  display_name     text not null check (char_length(display_name) between 2 and 24),
  current_streak   int  not null default 0,
  longest_streak   int  not null default 0,
  last_streak_date date,                                   -- last day all 3 levels were cleared
  streak_freezes   smallint not null default 0 check (streak_freezes between 0 and 1),
  created_at       timestamptz not null default now()
);

-- Creates a profile automatically when someone signs up.
-- The email prefix is cut to 20 chars so name + 3 digits always fits the 24-char limit.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'player'), 20)
      || floor(random()*900+100)::int
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ───────── topics & questions ─────────
create table topics (
  id         text primary key,                             -- slug, e.g. 'physics'
  name       text not null,
  icon       text,
  is_seed    boolean not null default false,               -- hand-written topic vs AI-generated
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table questions (
  id            uuid primary key default gen_random_uuid(),
  topic_id      text not null references topics on delete cascade,
  level         level not null,
  question      text not null,
  options       jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation   text,
  source        question_source not null default 'seed',
  status        question_status not null default 'active',
  report_count  int not null default 0,
  content_hash  text not null,                             -- hash of normalised question text, blocks duplicates
  created_at    timestamptz not null default now(),
  unique (topic_id, content_hash)
);
create index on questions (topic_id, level, status);

-- Same 5 questions for everyone on a given day, so daily scores are comparable.
-- (Not used by the app yet.)
create table daily_sets (
  id           uuid primary key default gen_random_uuid(),
  set_date     date not null,
  topic_id     text not null references topics on delete cascade,
  level        level not null,
  question_ids uuid[] not null check (cardinality(question_ids) = 5),
  unique (set_date, topic_id, level)
);

-- ───────── gameplay ─────────
-- One row per round (5 questions) a user plays.
create table attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles on delete cascade,
  topic_id      text not null references topics,
  level         level not null,
  is_daily      boolean not null default false,            -- true = played the shared daily set
  play_date     date not null default current_date,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  correct_count smallint,
  points        int,
  passed        boolean
);
create index on attempts (user_id, play_date);
create index on attempts (topic_id, play_date);

-- One row per question shown. The server writes shown_at when it sends the question
-- and checks the answer time itself, so the client can't fake speed or see answers early.
-- option_order remembers how the 4 options were shuffled for this player.
create table attempt_answers (
  attempt_id   uuid not null references attempts on delete cascade,
  position     smallint not null check (position between 0 and 4),
  question_id  uuid not null references questions,
  option_order smallint[] not null default '{0,1,2,3}',
  shown_at     timestamptz not null default now(),
  answered_at  timestamptz,
  chosen_index smallint check (chosen_index between 0 and 3),   -- null = timed out
  is_correct   boolean,
  points       int not null default 0,
  primary key (attempt_id, position)
);

-- One row per user + topic + day: the summary the dashboard and leaderboard read.
create table daily_scores (
  user_id            uuid not null references profiles on delete cascade,
  topic_id           text not null references topics,
  play_date          date not null,
  points             int not null default 0,
  questions_answered int not null default 0,
  correct            int not null default 0,
  rounds_played      int not null default 0,
  levels_cleared     level[] not null default '{}',
  avg_points         numeric generated always as (points::numeric / nullif(questions_answered, 0)) stored,
  primary key (user_id, topic_id, play_date)
);
create index on daily_scores (topic_id, play_date, avg_points desc);

-- Only players who cleared all 3 levels are ranked, so a lucky 1-question day can't top the board.
create view daily_leaderboard as
select ds.topic_id, ds.play_date, p.display_name, ds.user_id, ds.avg_points, ds.points,
       rank() over (partition by ds.topic_id, ds.play_date order by ds.avg_points desc) as rank
from daily_scores ds join profiles p on p.id = ds.user_id
where cardinality(ds.levels_cleared) = 3;

-- ───────── finishing a round (atomic) ─────────
-- Called by the server (service role) after the 5th answer: grades the round,
-- updates the day's summary, and moves the streak. Pass marks: 4/5, 4/5, 3/5.
create function finish_attempt(p_attempt uuid) returns attempts
language plpgsql security definer set search_path = public as $$
declare
  a attempts; s profiles; c int; pts int; g int; n int; f int; cleared level[];
begin
  select * into a from attempts where id = p_attempt and finished_at is null for update;
  if not found then raise exception 'attempt not found or already finished'; end if;

  select count(*) filter (where is_correct), coalesce(sum(points), 0)
    into c, pts from attempt_answers where attempt_id = p_attempt;

  update attempts set finished_at = now(), correct_count = c, points = pts,
         passed = c >= case level when 'advanced' then 3 else 4 end
   where id = p_attempt returning * into a;

  insert into daily_scores (user_id, topic_id, play_date, points, questions_answered, correct, rounds_played, levels_cleared)
  values (a.user_id, a.topic_id, a.play_date, pts, 5, c, 1, case when a.passed then array[a.level] else '{}'::level[] end)
  on conflict (user_id, topic_id, play_date) do update set
    points = daily_scores.points + excluded.points,
    questions_answered = daily_scores.questions_answered + 5,
    correct = daily_scores.correct + excluded.correct,
    rounds_played = daily_scores.rounds_played + 1,
    levels_cleared = case when a.passed and not (a.level = any (daily_scores.levels_cleared))
                          then daily_scores.levels_cleared || a.level else daily_scores.levels_cleared end
  returning levels_cleared into cleared;

  if cardinality(cleared) = 3 then
    select * into s from profiles where id = a.user_id for update;
    if s.last_streak_date is distinct from a.play_date then
      g := case when s.last_streak_date is null then 99 else a.play_date - s.last_streak_date end;
      f := s.streak_freezes;
      if g = 1 then n := s.current_streak + 1;
      elsif g = 2 and f > 0 then n := s.current_streak + 1; f := f - 1;
      else n := 1; end if;
      if n % 7 = 0 then f := least(1, f + 1); end if;
      update profiles set current_streak = n, longest_streak = greatest(longest_streak, n),
             last_streak_date = a.play_date, streak_freezes = f where id = a.user_id;
    end if;
  end if;
  return a;
end $$;
revoke execute on function finish_attempt(uuid) from public, anon, authenticated;
grant execute on function finish_attempt(uuid) to service_role;

-- ───────── security (Row Level Security) ─────────
-- Rule: players can read their own data. Anything that grades answers or writes scores
-- goes through the Next.js server using the service-role key, which bypasses RLS.
alter table profiles        enable row level security;
alter table topics          enable row level security;
alter table questions       enable row level security;   -- no policy: correct answers never reach the browser
alter table daily_sets      enable row level security;   -- no policy: server only
alter table attempts        enable row level security;
alter table attempt_answers enable row level security;
alter table daily_scores    enable row level security;

create policy "read own profile"  on profiles for select to authenticated using (id = auth.uid());
create policy "read topics"       on topics   for select to authenticated using (true);
create policy "read own attempts" on attempts for select to authenticated using (user_id = auth.uid());
create policy "read own answers"  on attempt_answers for select to authenticated
  using (exists (select 1 from attempts a where a.id = attempt_id and a.user_id = auth.uid()));
create policy "read own scores"   on daily_scores for select to authenticated using (user_id = auth.uid());

-- Users may rename themselves but can't touch streak columns.
revoke update on profiles from anon, authenticated;
grant update (display_name) on profiles to authenticated;
create policy "rename self" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- The leaderboard view runs with owner rights so it can show other players' display names only.
revoke all on daily_leaderboard from anon;
grant select on daily_leaderboard to authenticated;

-- ───────── seed topics ─────────
insert into topics (id, name, icon, is_seed) values
  ('physics', 'Physics', '⚛️', true),
  ('history', 'History', '🏛️', true),
  ('geography', 'Geography', '🌍', true);