"""
Diagnostic script - run this manually first.

Pulls yesterday's recordings from Pocket and prints the full raw JSON
for each one, so we can see the actual field names for attendees/
participants and action items before building the real automation.

Run: python inspect_recordings.py
"""
import json
import os
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv

load_dotenv()

POCKET_API_KEY = os.environ["POCKET_API_KEY"]
POCKET_BASE_URL = "https://public.heypocketai.com/api/v1"


def get_recent_recordings(limit=20):
    resp = requests.get(
        f"{POCKET_BASE_URL}/public/recordings",
        headers={"Authorization": f"Bearer {POCKET_API_KEY}"},
        params={"limit": limit, "sort": "-created_at"},
    )
    resp.raise_for_status()
    return resp.json()["data"]


def get_recording_detail(recording_id):
    resp = requests.get(
        f"{POCKET_BASE_URL}/public/recordings/{recording_id}",
        headers={"Authorization": f"Bearer {POCKET_API_KEY}"},
    )
    resp.raise_for_status()
    return resp.json()


def main():
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date()

    recordings = get_recent_recordings()
    print(f"Fetched {len(recordings)} recent recordings (list view):\n")
    print(json.dumps(recordings, indent=2))

    print("\n" + "=" * 80)
    print("Full detail for each recording from yesterday (or all, if date field unclear):")
    print("=" * 80)

    for rec in recordings:
        created_at = rec.get("created_at") or rec.get("createdAt") or rec.get("date")
        print(f"\n--- Recording {rec.get('id')} | created_at field value: {created_at!r} ---")
        detail = get_recording_detail(rec["id"])
        print(json.dumps(detail, indent=2))


if __name__ == "__main__":
    main()
