"""
Diagnostic script - run this manually first.

Prints only the field names/types/shape of the Pocket API responses
(truncating long text values) so we can see what data is available
without dumping full transcripts.

Run: python inspect_recordings.py
"""
import os

import requests
from dotenv import load_dotenv

load_dotenv()

POCKET_API_KEY = os.environ["POCKET_API_KEY"]
POCKET_BASE_URL = "https://public.heypocketai.com/api/v1"

MAX_STR_LEN = 80


def describe(value, indent=0):
    pad = "  " * indent
    if isinstance(value, dict):
        for key, v in value.items():
            if isinstance(v, (dict, list)):
                print(f"{pad}{key}:")
                describe(v, indent + 1)
            else:
                print(f"{pad}{key}: {summarize_scalar(v)}")
    elif isinstance(value, list):
        print(f"{pad}[list with {len(value)} item(s)]")
        if value:
            describe(value[0], indent + 1)
    else:
        print(f"{pad}{summarize_scalar(value)}")


def summarize_scalar(v):
    type_name = type(v).__name__
    if isinstance(v, str):
        preview = v if len(v) <= MAX_STR_LEN else v[:MAX_STR_LEN] + "...(truncated)"
        return f"({type_name}, len={len(v)}) {preview!r}"
    return f"({type_name}) {v!r}"


def get_recent_recordings(limit=5):
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
    recordings = get_recent_recordings(limit=30)
    print(f"Fetched {len(recordings)} recent recordings.\n")

    print("=== id | title | created_at for each recording ===")
    for rec in recordings:
        print(f"{rec.get('id')} | {rec.get('title')!r} | {rec.get('created_at')}")

    non_digest = [r for r in recordings if not str(r.get("id", "")).startswith("daily-highlights")]
    print(f"\n{len(non_digest)} of {len(recordings)} are NOT daily-highlights digests.")

    print("\n=== Shape of ONE list-view recording ===")
    if recordings:
        describe(recordings[0])

    target = non_digest[0] if non_digest else recordings[0]
    print(f"\n=== Shape of ONE full recording detail (id={target['id']}) ===")
    detail = get_recording_detail(target["id"])
    describe(detail)


if __name__ == "__main__":
    main()
