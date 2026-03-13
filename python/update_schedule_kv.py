"""
KBO 경기 일정 KV 갱신 — 특정 날짜의 최신 상태를 Naver API에서 받아 Cloudflare KV에 반영한다.

crawl_relay.py 실행 후 호출하여, 완료된 경기의 status·score를 KV에 반영한다.
wrangler CLI 없이 Cloudflare REST API를 직접 사용하므로 CI 환경에서 바로 실행 가능.

Usage:
    uv run python update_schedule_kv.py                      # 어제 (KST 기준)
    uv run python update_schedule_kv.py --date 2026-03-12    # 특정 날짜
    uv run python update_schedule_kv.py --dry-run             # KV에 쓰지 않고 확인만

환경변수 (GitHub Actions Secrets):
    CF_ACCOUNT_ID          — Cloudflare 계정 ID
    CF_KV_NAMESPACE_ID     — KV 네임스페이스 ID
    CF_API_TOKEN           — Cloudflare API 토큰 (KV 쓰기 권한)
"""

import argparse
import json
import os
from datetime import timedelta, timezone, datetime

import requests

# ── Naver Schedule API (crawl_schedule.py와 동일) ────────────────────────────

SCHEDULE_API = "https://api-gw.sports.naver.com/schedule/games"
NAVER_HEADERS = {
    "Origin": "https://m.sports.naver.com",
    "Referer": "https://m.sports.naver.com/kbaseball/schedule/index",
    "Accept": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}

STATUS_MAP = {
    "BEFORE": "upcoming",
    "LIVE": "live",
    "RESULT": "completed",
}

KST = timezone(timedelta(hours=9))


def yesterday_kst() -> str:
    return (datetime.now(KST) - timedelta(days=1)).strftime("%Y-%m-%d")


def fetch_schedule_for_date(target_date: str) -> list[dict]:
    """Naver API에서 특정 날짜의 경기 일정을 가져온다."""
    params = {
        "fields": "basic,schedule,baseball,manualRelayUrl",
        "upperCategoryId": "kbaseball",
        "categoryId": "kbo",
        "fromDate": target_date,
        "toDate": target_date,
        "roundCodes": "",
        "size": "500",
    }
    resp = requests.get(SCHEDULE_API, params=params, headers=NAVER_HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    if not data.get("success"):
        print(f"  ⚠ Naver API returned success=false for {target_date}")
        return []

    return data["result"]["games"]


def transform_game(raw: dict) -> dict:
    """네이버 API 응답 → 우리 스키마로 변환. (crawl_schedule.py와 동일)"""
    if raw.get("cancel"):
        status = "cancelled"
    elif raw.get("suspended"):
        status = "suspended"
    else:
        status = STATUS_MAP.get(raw.get("statusCode", ""), "upcoming")

    game: dict = {
        "id": raw["gameId"],
        "date": raw["gameDate"],
        "time": raw["gameDateTime"].split("T")[1][:5],
        "venue": raw.get("stadium", ""),
        "status": status,
        "away": {"code": raw["awayTeamCode"]},
        "home": {"code": raw["homeTeamCode"]},
    }

    if status in ("live", "completed"):
        game["away"]["score"] = raw.get("awayTeamScore")
        game["home"]["score"] = raw.get("homeTeamScore")

    if status == "live" and raw.get("statusInfo"):
        game["inning"] = raw["statusInfo"]

    if raw.get("broadChannel"):
        game["broadcast"] = raw["broadChannel"]

    if raw.get("roundCode"):
        game["roundCode"] = raw["roundCode"]

    return game


# ── Cloudflare KV REST API ───────────────────────────────────────────────────

def kv_put(key: str, value: str) -> bool:
    """Cloudflare KV REST API로 값을 쓴다."""
    account_id = os.environ.get("CF_ACCOUNT_ID")
    namespace_id = os.environ.get("CF_KV_NAMESPACE_ID")
    api_token = os.environ.get("CF_API_TOKEN")

    if not all([account_id, namespace_id, api_token]):
        print("  ⚠ Cloudflare 환경변수 미설정 (CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_API_TOKEN)")
        return False

    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
        f"/storage/kv/namespaces/{namespace_id}/values/{key}"
    )
    resp = requests.put(
        url,
        headers={
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        },
        data=value,
        timeout=15,
    )

    if resp.status_code != 200:
        print(f"  ✗ KV PUT 실패 ({key}): {resp.status_code} {resp.text[:200]}")
        return False

    return True


# ── 메인 ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="KBO 일정 KV 갱신 (날짜 단위)")
    parser.add_argument("--date", default=None, help="날짜 YYYY-MM-DD (기본: 어제 KST)")
    parser.add_argument("--dry-run", action="store_true", help="KV에 쓰지 않고 확인만")
    args = parser.parse_args()

    target_date = args.date or yesterday_kst()
    print(f"📅 대상 날짜: {target_date}")

    # 1. Naver API에서 최신 상태 조회
    raw_games = fetch_schedule_for_date(target_date)
    if not raw_games:
        print("  경기 없음")
        return

    games = [transform_game(g) for g in raw_games]
    print(f"  {len(games)}경기 조회됨:")
    for g in games:
        score = ""
        if g.get("away", {}).get("score") is not None:
            score = f" {g['away']['score']}:{g['home']['score']}"
        print(f"    {g['id']} {g['away']['code']} vs {g['home']['code']}{score} [{g['status']}]")

    # 2. KV 갱신
    key = f"schedule:{target_date}"
    value = json.dumps(games, ensure_ascii=False, separators=(",", ":"))

    if args.dry_run:
        print(f"\n  [DRY-RUN] {key} → {value[:120]}...")
        return

    ok = kv_put(key, value)
    if ok:
        print(f"\n  ✓ KV 갱신 완료: {key}")
    else:
        print(f"\n  ✗ KV 갱신 실패")


if __name__ == "__main__":
    main()
