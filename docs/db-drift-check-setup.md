# Setting up the database drift check

This is a one-time, 5-minute setup. Once it's in place, every time you push to
`main`, GitHub will automatically check whether your live database still
matches your migration files — and clearly flag it if it doesn't, before it
turns into a silent bug like the ones found during this audit.

The workflow file is already in your repo at
`.github/workflows/db-drift-check.yml`. It needs three secrets added to
GitHub before it will run successfully.

## 1. Add the secrets to GitHub

Go to your repo on GitHub → **Settings** → **Secrets and variables** →
**Actions** → **New repository secret**. Add these three, one at a time:

**`SUPABASE_PROJECT_REF`**
The value is: `jslilwvtribrszzzqcez`
(This is just your project's ID — not sensitive, but keeping it as a secret
is fine and simplest.)

**`SUPABASE_ACCESS_TOKEN`**
Go to [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens),
click **Generate new token**, give it any name (e.g. "GitHub Actions"), copy
the value it shows you (you only get to see it once), and paste it in as the
secret's value.

**`SUPABASE_DB_PASSWORD`**
Go to your project in the Supabase dashboard → **Project Settings** →
**Database** → **Database password**. If you don't remember it, there's a
**Reset database password** button there — resetting it is safe and won't
break your app (your app uses a separate API key, not this password).
Copy the password and paste it in as the secret's value.

## 2. Confirm it works

After adding all three secrets, go to your repo's **Actions** tab, find
"Database drift check" in the left sidebar, and click **Run workflow** to
trigger it manually the first time. It should finish green with "No drift".

From then on, it runs automatically every time you push to `main`.

## What to do if it ever fails

The failed run will print exactly what's different between your migration
files and the live database. Usually this means something was changed
directly in the live database (through the Supabase dashboard's SQL editor,
for example) without also being saved as a migration file. The fix is either:

- Write a migration file that captures whatever the live change was, or
- Undo the direct change so the live database matches the migrations again

Either way, you'll know about it within a minute of pushing, instead of
finding out later when a feature silently breaks.
