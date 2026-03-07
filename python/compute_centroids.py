"""
Compute classification centroids from player embeddings and metadata.

Outputs:
  - Position centroids (투수/타자)
  - Team centroids (10 KBO teams)
  - Global centroid + similarity distribution stats

Usage:
  cd python && uv run python compute_centroids.py
"""

import json
import math
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
EMBEDDINGS_PATH = DATA_DIR / "embeddings" / "player_embeddings_gallery.json"
METADATA_PATH = DATA_DIR / "metadata" / "player_metadata.json"
OUTPUT_PATH = DATA_DIR / "embeddings" / "classification_centroids.json"


def l2_normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vec))
    if norm < 1e-10:
        return vec
    return [v / norm for v in vec]


def mean_vector(vectors: list[list[float]]) -> list[float]:
    if not vectors:
        return []
    dim = len(vectors[0])
    result = [0.0] * dim
    for vec in vectors:
        for i in range(dim):
            result[i] += vec[i]
    n = len(vectors)
    return [v / n for v in result]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(ai * bi for ai, bi in zip(a, b))
    return dot  # Both are L2-normalized


def main() -> None:
    print(f"Loading metadata from {METADATA_PATH}")
    with open(METADATA_PATH) as f:
        metadata = json.load(f)

    print(f"Loading gallery embeddings from {EMBEDDINGS_PATH}")
    with open(EMBEDDINGS_PATH) as f:
        gallery = json.load(f)

    players = metadata["players"]
    gallery_players = gallery["players"]

    # Build per-player representative embedding (mean of gallery embeddings, L2-normalized)
    player_embeddings: dict[str, list[float]] = {}
    for p in players:
        pid = p["id"]
        entry = gallery_players.get(pid)
        if not entry or not entry["embeddings"]:
            continue
        avg = mean_vector(entry["embeddings"])
        player_embeddings[pid] = l2_normalize(avg)

    print(f"Players with embeddings: {len(player_embeddings)}/{len(players)}")

    # Build lookup
    player_map = {p["id"]: p for p in players}

    # ── Position centroids ──
    position_groups: dict[str, list[list[float]]] = {}
    for pid, emb in player_embeddings.items():
        pos = player_map[pid]["position"]
        position_groups.setdefault(pos, []).append(emb)

    position_centroids = {}
    for pos, vecs in position_groups.items():
        centroid = l2_normalize(mean_vector(vecs))
        position_centroids[pos] = {
            "centroid": centroid,
            "count": len(vecs),
        }
        print(f"  Position '{pos}': {len(vecs)} players")

    # ── Team centroids ──
    team_groups: dict[str, list[list[float]]] = {}
    team_names: dict[str, str] = {}
    for pid, emb in player_embeddings.items():
        tc = player_map[pid]["teamCode"]
        team_groups.setdefault(tc, []).append(emb)
        team_names[tc] = player_map[pid]["team"]

    team_centroids = {}
    for tc, vecs in sorted(team_groups.items(), key=lambda x: -len(x[1])):
        centroid = l2_normalize(mean_vector(vecs))
        team_centroids[tc] = {
            "centroid": centroid,
            "count": len(vecs),
            "name": team_names[tc],
        }
        print(f"  Team '{tc}' ({team_names[tc]}): {len(vecs)} players")

    # ── Global centroid + distribution stats ──
    all_embeddings = list(player_embeddings.values())
    global_centroid = l2_normalize(mean_vector(all_embeddings))

    # Cosine similarity of each player to global centroid
    similarities = [cosine_similarity(emb, global_centroid) for emb in all_embeddings]
    n = len(similarities)
    sim_mean = sum(similarities) / n
    sim_std = math.sqrt(sum((s - sim_mean) ** 2 for s in similarities) / n)

    print(f"\n  Global centroid similarity: mean={sim_mean:.4f}, std={sim_std:.4f}")
    print(f"  Range: [{min(similarities):.4f}, {max(similarities):.4f}]")

    # ── Build output ──
    output = {
        "version": "1.0",
        "position": position_centroids,
        "team": team_centroids,
        "global": {
            "centroid": global_centroid,
            "similarity_mean": round(sim_mean, 6),
            "similarity_std": round(sim_std, 6),
        },
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, ensure_ascii=False)

    file_size = OUTPUT_PATH.stat().st_size
    print(f"\nOutput written to {OUTPUT_PATH} ({file_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
