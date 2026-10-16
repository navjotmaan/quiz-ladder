# Quiz Ladder

A daily quiz game. Pick a topic, climb three levels (beginner → intermediate → advanced), answer against a 15-second timer, and keep your daily streak alive.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth) · Google OAuth

---

## Table of contents

1. [How it works](#how-it-works)
2. [Prerequisites](#prerequisites)
3. [Setup](#setup)
   - [1. Clone and install](#1-clone-and-install)
   - [2. Create a Supabase project](#2-create-a-supabase-project)
   - [3. Create the database](#3-create-the-database)
   - [4. Set up Google login](#4-set-up-google-login)
   - [5. Configure environment variables](#5-configure-environment-variables)
   - [6. Seed the questions](#6-seed-the-questions)
   - [7. Run the app](#7-run-the-app)
4. [Verify everything works](#verify-everything-works)
5. [Project structure](#project-structure)
6. [Game rules](#game-rules)
7. [Deploying](#deploying)
8. [Troubleshooting](#troubleshooting)

---

## How it works

- **Auth:** Users sign in with Google. Supabase Auth talks to Google and stores the session in cookies. `middleware.ts` keeps the session fresh and redirects logged-out users away from `/dashboard` and `/play`.
- **Questions live in the database**, and the correct answers never reach the browser until a question has been answered.
- **The server is the referee.** Browser actions call server actions in `lib/quiz-actions.ts`, which pick questions, time answers, score them, and write results using the Supabase service-role key. The browser only displays and sends clicks.
- **Streaks and daily scores** are updated atomically by the `finish_attempt` SQL function when a round ends.

```
Browser (components/Quiz.tsx)
   │  server actions
   ▼
lib/quiz-actions.ts ──► Supabase Postgres (admin client, bypasses RLS)
   ▲
lib/progress.ts ──► Supabase Postgres (user's own session, RLS applies)
```

## Prerequisites

- **Node.js 20.6 or newer** and npm (`node -v` to check)
- A free [Supabase](https://supabase.com) account
- A [Google Cloud](https://console.cloud.google.com) account (for the OAuth credentials)
- Git

## Setup

### 1. Clone and install

```bash
git clone https://github.com/navjotmaan/quiz-ladder.git
cd quiz-ladder
npm install
```

### 2. Create a Supabase project

1. In the Supabase dashboard, click **New project** and pick a name, region, and database password (save the password somewhere).
2. Wait for the project to finish provisioning.
3. Open **Project Settings → API** and keep this page open. You'll need the **Project URL**, the **publishable (anon) key**, and the **service-role (secret) key** in step 5.


### 3. Create the database

1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. In **Table Editor** you should now see 7 tables: `profiles`, `topics`, `questions`, `daily_sets`, `attempts`, `attempt_answers`, `daily_scores`. The `topics` table should contain `physics`, `history`, and `geography`.

Run the schema only once on a fresh project. Running it twice fails because the types and tables already exist.

### 4. Set up Google login

**a) Google Cloud Console**

1. Create a project (or choose an existing one).
2. Go to **APIs & Services → OAuth consent screen**, choose **External**, and fill in the app name and your email. Add yourself as a test user while the app is in testing mode.
3. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
4. Application type: **Web application**.
5. Under **Authorized redirect URIs**, add exactly:

   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

   Your project ref is the part before `.supabase.co` in your Project URL. This is Supabase's URL, not your app's.
6. Create it and copy the **Client ID** and **Client Secret**.

**b) Supabase dashboard**

1. Go to **Authentication → Providers → Google**, enable it, and paste in the Client ID and Client Secret.
2. Go to **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** add `http://localhost:3000/**`

### 5. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` using the values from **Project Settings → API**:

| Variable | Where to find it | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable / anon key | Yes (safe by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role / secret key | **No. Server only** |

> ⚠️ The service-role key bypasses all database security. Never prefix it with `NEXT_PUBLIC_`, never commit `.env.local`, and never paste it into client code.

### 6. Seed the questions

The starter questions are in `data/questions.json`. Load them into the database:

```bash
npx --yes tsx --env-file=.env.local scripts/seed-questions.ts
```

You should see `Seeded 45 questions`. The script is safe to re-run; duplicates are skipped.

### 7. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verify everything works

Go through this checklist once after setup:

1. **Logged-out protection:** in a private window, open `http://localhost:3000/dashboard`. You should be redirected to `/`.
2. **Login:** click **Sign in with Google** and approve. You should land on `/dashboard`.
3. **Profile created:** in Supabase, check **Authentication → Users** and **Table Editor → profiles**. Your account should appear in both.
4. **Play a round:** pick a topic and answer 5 questions. In the Table Editor, `attempts`, `attempt_answers`, and `daily_scores` should now have rows.
5. **Level progression:** clear beginner, go back home, and reopen the topic. It should start at intermediate.
6. **Streak:** clear all three levels of a topic. Your streak on the dashboard becomes 1.
7. **Logout:** log out, then try `/dashboard` again. You should be sent to `/`.

## Project structure

```
app/
  auth/callback/route.ts   Finishes Google login: exchanges the code for a session
  dashboard/page.tsx       Topic picker, streak, today's progress (server component)
  play/[topic]/page.tsx    Loads the quiz for a topic at the right starting level
components/
  Quiz.tsx                 Quiz UI: timer, answer buttons, results (client component)
  logout.tsx               Logout button
  login.tsx                Login button
lib/
  game.ts                  Shared constants, types, and score() used by client and server
  quiz-actions.ts          Server actions: start round, serve question, grade answer, finish
  progress.ts              Read-only data for the dashboard and starting level
  supabase/
    client.ts              Browser client (acts as the logged-in user)
    server.ts              Server client (acts as the logged-in user, reads cookies)
    admin.ts               Service-role client (full access, server only)
middleware.ts              Refreshes the session; protects /dashboard and /play
data/questions.json        Starter questions (used by the seed script)
scripts/seed-questions.ts  Loads data/questions.json into the database
supabase/schema.sql        Full database schema, security policies, and seed topics
```

**Which Supabase client do I use?**

| Where | Client | Row Level Security |
|---|---|---|
| Client components | `lib/supabase/client.ts` | Applies |
| Server components, route handlers | `lib/supabase/server.ts` | Applies |
| Trusted server code that grades or writes scores | `lib/supabase/admin.ts` | Bypassed. Verify the user first |

## Game rules

- Each round is 5 questions with 15 seconds each.
- A correct answer scores 100 points plus up to 50 for speed. Wrong answers and timeouts score 0.
- Pass marks: **4/5** for beginner and intermediate, **3/5** for advanced.
- Levels unlock in order, per topic, per day.
- Clearing all three levels of any topic in a day extends your streak.
- A missed day is covered by a streak freeze if you have one. You earn a freeze at every 7-day milestone (max 1 held).
- Days are counted in **UTC**.

The pass marks live in two places: `PASS` in `lib/game.ts` (for display) and inside `finish_attempt` in `supabase/schema.sql` (the real rule). Change both together.

## Deploying

Tested approach: [Vercel](https://vercel.com).

1. Push the repo to GitHub and import it in Vercel.
2. Add the three environment variables from step 5 in **Project Settings → Environment Variables**.
3. Deploy, then copy your production URL.
4. In Supabase **Authentication → URL Configuration**, set **Site URL** to the production URL and add `https://<your-domain>/**` to **Redirect URLs** (keep the localhost entry for development).
5. The Google OAuth redirect URI does **not** change; it still points at Supabase.
6. Before going public, move the Google consent screen from *Testing* to *In production* so anyone can sign in.

Use a separate Supabase project for production if you can, and run `supabase/schema.sql` and the seed script against it.


## Notes for contributors

- Keep `lib/game.ts` free of server-only and browser-only code, because both sides import it.
- Every server action in `lib/quiz-actions.ts` must call `requireUser()` first and use `user.id` from the verified session, never an id sent from the browser.
- Never import `lib/supabase/admin.ts` from a client component. It uses `server-only` and the build will fail if you do.