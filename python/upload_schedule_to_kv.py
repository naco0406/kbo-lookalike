"""
크롤링된 KBO 일정 데이터를 Cloudflare Workers KV에 업로드한다.

KV 키 구조:
  schedule:2026-03-12  → 해당 날짜 경기 JSON 배열
  schedule:dates:2026  → 경기가 있는 날짜 목록 배열

Usage:
    uv run python upload_schedule_to_kv.py
    uv run python upload_schedule_to_kv.py --year 2025
    uv run python upload_schedule_to_kv.py --dry-run   # KV에 쓰지 않고 확인만
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path


def kv_put(key: str, value: str, namespace_id: str, dry_run: bool = False) -> bool:
    """wrangler CLI로 KV에 값을 쓴다."""
    if dry_run:
        preview = value[:80] + "..." if len(value) > 80 else value
        print(f"  [DRY-RUN] {key} → {preview}")
        return True

    result = subprocess.run(
        [
            "wrangler", "kv", "key", "put",
            "--namespace-id", namespace_id,
            "--remote",
            key, value,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  ✗ Failed to put {key}: {result.stderr.strip()}")
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="KBO 일정 → Cloudflare KV 업로드")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--namespace-id", default="d18842f0400443a399f685b5a0f1329f")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    schedule_path = Path(__file__).parent.parent / "data" / "schedule" / f"kbo_{args.year}.json"
    if not schedule_path.exists():
        print(f"✗ Schedule file not found: {schedule_path}")
        sys.exit(1)

    data = json.loads(schedule_path.read_text(encoding="utf-8"))
    schedule: dict[str, list] = data["schedule"]
    dates = sorted(schedule.keys())

    print(f"Uploading {len(dates)} dates ({data['totalGames']} games) to KV...")
    if args.dry_run:
        print("(DRY-RUN mode — no writes)\n")

    # 1) 각 날짜별 경기 업로드
    success = 0
    for i, date in enumerate(dates, 1):
        games = schedule[date]
        key = f"schedule:{date}"
        value = json.dumps(games, ensure_ascii=False, separators=(",", ":"))
        if kv_put(key, value, args.namespace_id, args.dry_run):
            success += 1
        if i % 20 == 0:
            print(f"  ... {i}/{len(dates)} dates uploaded")

    # 2) 날짜 인덱스 업로드
    index_key = f"schedule:dates:{args.year}"
    index_value = json.dumps(dates, separators=(",", ":"))
    kv_put(index_key, index_value, args.namespace_id, args.dry_run)

    print(f"\n✓ Done! {success}/{len(dates)} dates + 1 index key uploaded.")


if __name__ == "__main__":
    main()
