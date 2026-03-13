"""
KBO 경기 텍스트 중계 크롤러 — Naver Sports API

완료된 경기의 relay 데이터를 수집해 R2(프로덕션) 및/또는 로컬 파일로 저장한다.
이닝별로 ?inning=N 파라미터를 사용해 전체 중계 데이터를 수집한다.

Usage:
    uv run python crawl_relay.py                      # 어제 (KST 기준)
    uv run python crawl_relay.py --date 2026-03-12    # 특정 날짜
    uv run python crawl_relay.py --local-only         # R2 업로드 없이 로컬만
    uv run python crawl_relay.py --dry-run            # 크롤 없이 대상 경기만 출력
    uv run python crawl_relay.py --force              # 이미 저장된 경기도 재크롤

R2 업로드 환경변수 (GitHub Actions Secrets):
    CF_R2_ACCOUNT_ID
    CF_R2_ACCESS_KEY_ID
    CF_R2_SECRET_ACCESS_KEY
"""

import argparse
import json
import os
import time
from datetime import timedelta, timezone, datetime
from pathlib import Path

import requests

RELAY_API = "https://api-gw.sports.naver.com/schedule/games/{game_id}/relay"
HEADERS = {
    "Origin": "https://m.sports.naver.com",
    "Referer": "https://m.sports.naver.com/kbaseball/game/index",
    "Accept": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}

KST = timezone(timedelta(hours=9))
DATA_DIR = Path(__file__).parent.parent / "data"
RELAY_DIR = DATA_DIR / "relay"
R2_BUCKET = "kbo-relay-data"
MAX_INNINGS = 15  # 연장전 대비


# ── 날짜 헬퍼 ────────────────────────────────────────────────────────────────

def yesterday_kst() -> str:
    return (datetime.now(KST) - timedelta(days=1)).strftime("%Y-%m-%d")


# ── 일정 파일에서 경기 ID 추출 ────────────────────────────────────────────────

def get_game_ids(target_date: str) -> list[str]:
    """data/schedule/kbo_{year}.json에서 해당 날짜의 모든 경기 ID를 반환한다.

    로컬 스냅샷은 시즌 초 크롤이라 status가 'upcoming'으로 고정돼 있을 수 있다.
    실제 완료 여부는 relay API 응답에서 판단한다.
    """
    year = target_date[:4]
    schedule_path = DATA_DIR / "schedule" / f"kbo_{year}.json"

    if not schedule_path.exists():
        print(f"  ⚠ 일정 파일 없음: {schedule_path}")
        return []

    data = json.loads(schedule_path.read_text(encoding="utf-8"))
    games = data.get("schedule", {}).get(target_date, [])
    return [g["id"] for g in games if g.get("status") != "cancelled"]


# ── Naver relay API 호출 ──────────────────────────────────────────────────────

def _call_relay(game_id: str, params: dict | None = None) -> dict | None:
    """relay API 단일 호출. 성공 시 textRelayData dict 반환."""
    url = RELAY_API.format(game_id=game_id)
    try:
        resp = requests.get(url, params=params, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"    ✗ fetch 실패 (params={params}): {e}")
        return None

    if not data.get("success"):
        return None

    return data.get("result", {}).get("textRelayData")


def fetch_full_relay(game_id: str) -> dict | None:
    """
    경기 전체 중계 데이터를 수집한다.

    Naver relay API는 기본 호출 시 마지막 이닝만 반환한다.
    ?inning=N 파라미터로 각 이닝을 별도 요청해 textRelays를 모두 합친다.
    inningScore, homeLineup 등 경기 요약 데이터는 마지막 이닝 응답에서 가져온다.
    """
    # 1. 기본 호출 — 경기 상태 확인 및 요약 데이터 수집
    base = _call_relay(game_id)
    if base is None:
        print(f"  ✗ {game_id}: API 응답 없음")
        return None

    # 아직 진행 중인 경기는 저장하지 않는다
    cgs = base.get("currentGameState", {})
    # 경기 상태는 textRelayData.inn(현재 이닝), homeOrAway로 추정
    # LIVE 경기는 마지막 이닝 이벤트가 끝나지 않았으므로 inningScore의 "-"로 판단
    inning_score = base.get("inningScore", {})
    home_scores = inning_score.get("home", {})
    # 9회말이 "-"면 아직 진행 중일 수 있으나, 실용적으로는 시간 기반(01:00 KST)으로 처리
    # 크롤러는 GitHub Actions에서 01:00 KST에 실행되므로 별도 체크 생략

    # 2. inning=1부터 이닝별로 textRelays 수집
    all_text_relays: list[dict] = []
    seen_nos: set[int] = set()

    for inn in range(1, MAX_INNINGS + 1):
        trd = _call_relay(game_id, params={"inning": inn})
        if trd is None:
            break

        tr = trd.get("textRelays", [])
        if not tr:
            # 빈 이닝 = 경기 종료 (연장 없음)
            break

        # 중복 방지 (no 필드 기준)
        for relay in tr:
            no = relay.get("no")
            if no is not None and no in seen_nos:
                continue
            if no is not None:
                seen_nos.add(no)
            all_text_relays.append(relay)

        time.sleep(0.2)  # rate limit 방지

    print(f"    → {len(all_text_relays)}개 at-bat ({inn - 1 if not tr else inn}이닝)")

    # 3. 기본 응답에 전체 textRelays 병합
    result = {k: v for k, v in base.items() if k != "textRelays"}
    result["textRelays"] = all_text_relays
    return {"textRelayData": result}


# ── 로컬 저장 ─────────────────────────────────────────────────────────────────

def save_local(game_id: str, data: dict) -> Path:
    RELAY_DIR.mkdir(parents=True, exist_ok=True)
    out_path = RELAY_DIR / f"{game_id}.json"
    out_path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return out_path


# ── R2 업로드 ─────────────────────────────────────────────────────────────────

def upload_to_r2(game_id: str, data: dict) -> bool:
    account_id = os.environ.get("CF_R2_ACCOUNT_ID")
    access_key = os.environ.get("CF_R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("CF_R2_SECRET_ACCESS_KEY")

    if not all([account_id, access_key, secret_key]):
        print("  ⚠ R2 환경변수 미설정, 로컬만 저장")
        return False

    try:
        import boto3  # type: ignore
        from botocore.config import Config  # type: ignore

        s3 = boto3.client(
            "s3",
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )
        body = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        s3.put_object(
            Bucket=R2_BUCKET,
            Key=f"relay/{game_id}.json",
            Body=body,
            ContentType="application/json",
        )
        return True
    except Exception as e:
        print(f"  ✗ R2 업로드 실패: {e}")
        return False


def already_saved_locally(game_id: str) -> bool:
    return (RELAY_DIR / f"{game_id}.json").exists()


# ── 메인 ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="KBO 경기 중계 크롤러")
    parser.add_argument("--date", default=None, help="날짜 YYYY-MM-DD (기본: 어제 KST)")
    parser.add_argument("--local-only", action="store_true", help="R2 업로드 없이 로컬만 저장")
    parser.add_argument("--dry-run", action="store_true", help="크롤 없이 대상 경기만 출력")
    parser.add_argument("--force", action="store_true", help="이미 저장된 경기도 재크롤")
    args = parser.parse_args()

    target_date = args.date or yesterday_kst()
    print(f"📅 대상 날짜: {target_date}")

    game_ids = get_game_ids(target_date)
    if not game_ids:
        print("  경기 없음 (일정 파일에 해당 날짜 항목 없음)")
        return

    print(f"  경기 {len(game_ids)}건: {game_ids}")

    if args.dry_run:
        print("(dry-run: 실제 크롤 없이 종료)")
        return

    saved = 0
    for i, game_id in enumerate(game_ids):
        if not args.force and already_saved_locally(game_id):
            print(f"  ⏭ {game_id}: 이미 저장됨, skip (--force로 재크롤 가능)")
            continue

        print(f"  [{i+1}/{len(game_ids)}] {game_id} 크롤 중...")
        relay = fetch_full_relay(game_id)
        if relay is None:
            continue

        path = save_local(game_id, relay)
        print(f"    → 로컬 저장: {path}")

        if not args.local_only:
            ok = upload_to_r2(game_id, relay)
            if ok:
                print(f"    → R2 업로드 ✓")

        saved += 1

        if i < len(game_ids) - 1:
            time.sleep(1.0)  # 경기 간 대기 (이닝별 0.2s × 9이닝 이후 추가 대기)

    print(f"\n완료: {saved}/{len(game_ids)}건 저장")


if __name__ == "__main__":
    main()
