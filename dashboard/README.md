# Pocket Meeting Dashboard

Web dashboard for reviewing the previous day's Pocket meeting recordings
and emailing selected summaries (with action items) to a chosen set of
recipients.

## Deploying to Vercel

1. Push this repo to GitHub (already done).
2. In Vercel, "Add New Project" and import this repo, setting the
   **Root Directory** to `dashboard`.
3. In the Vercel project, go to **Storage** and create a **KV** database,
   then link it to this project (Vercel injects `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` automatically once linked).
4. In **Settings -> Environment Variables**, add:
   - `POCKET_API_KEY`
   - `GMAIL_ADDRESS`
   - `GMAIL_APP_PASSWORD` (a Gmail App Password, not your normal password)
5. Deploy. Vercel will give you a URL like
   `https://your-project.vercel.app` - open it to use the dashboard.

## Local development

```
cd dashboard
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

Note: local dev needs a KV store too (Vercel CLI can pull env vars with
`vercel env pull`), otherwise the recipients list endpoints will error.

## How it works

- `/api/meetings` pulls recordings from Pocket created since the start of
  yesterday, skips daily-highlights digests (we want per-meeting context,
  not a merged daily rollup), and returns each meeting's summary and
  structured action items.
- `/api/recipients` reads/writes the recipient list in Vercel KV.
- `/api/send` emails the selected meetings' summaries + action items to
  the selected recipients via Gmail SMTP.

The dashboard has no login - treat the deployed URL as private and don't
share it publicly.
