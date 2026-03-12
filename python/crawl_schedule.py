"""
KBO 시즌 일정 크롤러 — Naver Sports API

Usage:
    uv run python crawl_schedule.py          # 2026 시즌 전체
    uv run python crawl_schedule.py --year 2025
"""

import argparse
import json
import time
from datetime import date
from pathlib import Path

import requests

API_URL = "https://api-gw.sports.naver.com/schedule/games"
HEADERS = {
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


def fetch_month(year: int, month: int) -> list[dict]:
    """한 달 치 경기 일정을 가져온다."""
    from_date = f"{year}-{month:02d}-01"
    # 마지막 날짜 계산
    if month == 12:
        to_date = f"{year}-12-31"
    else:
        to_date = f"{year}-{month + 1:02d}-01"
        # 하루 빼기
        to_day = date(year, month + 1, 1).toordinal() - 1
        to_date = date.fromordinal(to_day).isoformat()

    params = {
        "fields": "basic,schedule,baseball,manualRelayUrl",
        "upperCategoryId": "kbaseball",
        "categoryId": "kbo",
        "fromDate": from_date,
        "toDate": to_date,
        "roundCodes": "",
        "size": "500",
    }

    resp = requests.get(API_URL, params=params, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    if not data.get("success"):
        print(f"  ⚠ API returned success=false for {from_date}")
        return []

    return data["result"]["games"]


def transform_game(raw: dict) -> dict:
    """네이버 API 응답 → 우리 스키마로 변환."""
    # 상태 결정
    if raw.get("cancel"):
        status = "cancelled"
    elif raw.get("suspended"):
        status = "suspended"
    else:
        status = STATUS_MAP.get(raw.get("statusCode", ""), "upcoming")

    game: dict = {
        "id": raw["gameId"],
        "date": raw["gameDate"],
        "time": raw["gameDateTime"].split("T")[1][:5],  # "18:30"
        "venue": raw.get("stadium", ""),
        "status": status,
        "away": {"code": raw["awayTeamCode"]},
        "home": {"code": raw["homeTeamCode"]},
    }

    # 스코어 (경기 시작 후에만)
    if status in ("live", "completed"):
        game["away"]["score"] = raw.get("awayTeamScore")
        game["home"]["score"] = raw.get("homeTeamScore")

    # 이닝 정보 (진행중일 때)
    if status == "live" and raw.get("statusInfo"):
        game["inning"] = raw["statusInfo"]

    # 중계 채널
    if raw.get("broadChannel"):
        game["broadcast"] = raw["broadChannel"]

    # 라운드 코드 (시범/정규/포스트시즌 구분)
    if raw.get("roundCode"):
        game["roundCode"] = raw["roundCode"]

    return game


def main():
    parser = argparse.ArgumentParser(description="KBO 시즌 일정 크롤러")
    parser.add_argument("--year", type=int, default=2026, help="시즌 연도")
    args = parser.parse_args()
    year = args.year

    all_games: list[dict] = []
    # KBO 시즌: 2월(스프링캠프) ~ 11월(한국시리즈)
    for month in range(2, 12):
        print(f"Fetching {year}-{month:02d}...")
        raw_games = fetch_month(year, month)
        games = [transform_game(g) for g in raw_games]
        all_games.extend(games)
        print(f"  → {len(games)} games")
        if month < 11:
            time.sleep(0.5)  # rate limit 방지

    # 날짜별로 그룹핑
    by_date: dict[str, list[dict]] = {}
    for game in all_games:
        d = game["date"]
        by_date.setdefault(d, []).append(game)

    output = {
        "version": "1.0",
        "year": year,
        "totalGames": len(all_games),
        "totalDates": len(by_date),
        "schedule": by_date,
    }

    out_dir = Path(__file__).parent.parent / "data" / "schedule"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"kbo_{year}.json"
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nDone! {len(all_games)} games across {len(by_date)} dates → {out_path}")


if __name__ == "__main__":
    main()
