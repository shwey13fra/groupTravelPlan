# TripSync

Group trip planning — without the chaos. A portfolio prototype built with Next.js 14, Supabase, and Claude AI.

---

## Tech Stack

- **Next.js 14** App Router + TypeScript strict mode
- **Tailwind CSS** + shadcn/ui (New York style)
- **Supabase** — Postgres, Realtime, Storage, Auth
- **Anthropic SDK** (`claude-sonnet-4-6`) for AI nudges
- **Vercel** for deployment

---

## Local Setup

```bash
npm install
cp .env.example .env.local   # then fill in values (see below)
npm run dev
```

---

## Supabase Setup (Dashboard — no CLI needed)

### Step 1 — Create a Supabase project
Go to https://supabase.com, create a new project, and wait for it to provision.

### Step 2 — Run the schema migration
1. In your Supabase project, go to **SQL Editor**
2. Click **New query**
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql` and paste it in
4. Click **Run**
5. You should see "Success. No rows returned."

### Step 3 — Set up Storage
1. Still in **SQL Editor**, click **New query**
2. Copy the entire contents of `supabase/migrations/002_storage.sql` and paste it in
3. Click **Run**

   > If you get a "bucket already exists" error, that's fine — the `ON CONFLICT DO NOTHING` handles it.
   > If you prefer the UI: go to **Storage → Create bucket**, name it `trip-vault`, toggle **Public bucket** on.

### Step 4 — Enable Realtime
Go to **Database → Replication** and enable Realtime for these tables:

| Table                    | Reason                              |
|--------------------------|-------------------------------------|
| `trips`                  | AI nudge updates                    |
| `trip_members`           | Commitment status changes           |
| `destination_suggestions`| New suggestions appear live         |
| `destination_votes`      | Vote counts update in real time     |
| `itinerary_items`        | Collaborative itinerary editing     |
| `tasks`                  | Task status syncs across members    |
| `expenses`               | New expenses visible immediately    |
| `expense_splits`         | Settlement status syncs             |

### Step 5 — Get your API keys
Go to **Project Settings → API** and copy:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — server only)

---

## Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

For Vercel: add the same four keys in **Project Settings → Environment Variables**.

---

## Vercel Deployment

```bash
# Push to GitHub (already connected to Vercel)
git push origin master
```

Or connect the GitHub repo to Vercel via the dashboard. Set env vars before the first deploy.

---

## Project Structure

```
/app                    Next.js App Router pages
/components/ui          shadcn/ui components
/components/trip        Custom trip components
/lib/supabase           Browser + server Supabase clients
/lib/anthropic          Anthropic SDK wrapper
/lib/types              Shared TypeScript types (database.ts)
/supabase/migrations    SQL migration files
/scripts                Utility scripts (smoke test etc.)
```
