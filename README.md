# Pocket Meeting Summary Automation

Fetches the latest Pocket recording's summary and emails it to a static
recipient list via Gmail.

## Setup

1. `pip install -r requirements.txt`
2. Copy `.env.example` to `.env` and fill in:
   - `POCKET_API_KEY` - from Pocket Settings -> Developers -> API Keys
   - `GMAIL_ADDRESS` - the sending Gmail account
   - `GMAIL_APP_PASSWORD` - a Gmail App Password (Google Account -> Security
     -> 2-Step Verification -> App Passwords). Do not use your normal Gmail
     password.
3. Edit `RECIPIENTS` in `send_meeting_summary.py` with the real email
   addresses.
4. Run once manually to confirm it works and to check the printed raw
   recording response - this tells you the actual summary field name to use
   if it differs from `summary`/`ai_summary`:

   ```
   python send_meeting_summary.py
   ```

## Scheduling

Add a cron entry to run after meetings, e.g. daily at 6pm:

```
0 18 * * * cd /path/to/pocketautomation && /usr/bin/python3 send_meeting_summary.py >> run.log 2>&1
```

## Notes

- Never commit `.env` - it holds your live API key and email credentials.
- The script always grabs the single most recent recording. If multiple
  meetings happen in a day, this only sends the latest one - flag this if
  that's not the desired behavior and we can switch to "all recordings since
  last run" instead.
