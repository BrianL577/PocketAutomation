import os
import smtplib
from email.mime.text import MIMEText

import requests
from dotenv import load_dotenv

load_dotenv()

POCKET_API_KEY = os.environ["POCKET_API_KEY"]
GMAIL_ADDRESS = os.environ["GMAIL_ADDRESS"]
GMAIL_APP_PASSWORD = os.environ["GMAIL_APP_PASSWORD"]

POCKET_BASE_URL = "https://public.heypocketai.com/api/v1"

# Static recipient list - rarely changes
RECIPIENTS = [
    "recipient1@example.com",
    "recipient2@example.com",
]


def get_latest_recording():
    resp = requests.get(
        f"{POCKET_BASE_URL}/public/recordings",
        headers={"Authorization": f"Bearer {POCKET_API_KEY}"},
        params={"limit": 1, "sort": "-created_at"},
    )
    resp.raise_for_status()
    recordings = resp.json()["data"]
    if not recordings:
        raise RuntimeError("No recordings found")
    return recordings[0]


def get_recording_summary(recording_id):
    resp = requests.get(
        f"{POCKET_BASE_URL}/public/recordings/{recording_id}",
        headers={"Authorization": f"Bearer {POCKET_API_KEY}"},
    )
    resp.raise_for_status()
    data = resp.json()
    print("Raw recording detail response (for confirming field names):")
    print(data)
    # Placeholder field name - confirm against the printed response above
    # and adjust if Pocket calls it something else (e.g. "ai_summary").
    return data.get("summary") or data.get("ai_summary")


def send_email(subject, body):
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = ", ".join(RECIPIENTS)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_ADDRESS, RECIPIENTS, msg.as_string())


def main():
    recording = get_latest_recording()
    summary = get_recording_summary(recording["id"])
    if not summary:
        raise RuntimeError("No summary found on recording - check field name in raw response above")

    title = recording.get("title", "Meeting")
    send_email(subject=f"Meeting Summary: {title}", body=summary)
    print(f"Sent summary for '{title}' to {len(RECIPIENTS)} recipients")


if __name__ == "__main__":
    main()
