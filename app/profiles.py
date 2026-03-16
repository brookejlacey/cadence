"""Voice profile persistence — saves what Cadence learns between sessions."""

import json
import logging
import time
from pathlib import Path

logger = logging.getLogger("cadence.profiles")

PROFILES_DIR = Path(__file__).parent / "data" / "profiles"
PROFILES_DIR.mkdir(parents=True, exist_ok=True)


def _profile_path(user_id: str) -> Path:
    safe_id = "".join(c for c in user_id if c.isalnum() or c in ("_", "-"))
    return PROFILES_DIR / f"{safe_id}.json"


def load_profile(user_id: str) -> dict | None:
    path = _profile_path(user_id)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        logger.exception("Failed to load profile for %s", user_id)
        return None


def save_profile(user_id: str, profile: dict) -> dict:
    profile = {**profile}  # shallow copy to avoid mutating caller's dict
    profile["updated_at"] = time.time()
    if "created_at" not in profile:
        existing = load_profile(user_id)
        profile["created_at"] = (
            existing["created_at"] if existing else profile["updated_at"]
        )
    path = _profile_path(user_id)
    path.write_text(json.dumps(profile, indent=2), encoding="utf-8")
    logger.info("Saved profile for %s", user_id)
    return profile


def list_profiles() -> list[dict]:
    profiles = []
    for path in PROFILES_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            data["user_id"] = path.stem
            profiles.append(data)
        except Exception:
            continue
    return sorted(profiles, key=lambda p: p.get("updated_at", 0), reverse=True)


# --- Demo profile for hackathon judges ---

DEMO_PROFILE = {
    "user_id": "demo_creator",
    "creator_name": "Alex Rivera",
    "platform": "TikTok / YouTube Shorts",
    "videos_analyzed": 12,
    "sessions_completed": 3,
    "signature_moves": [
        "The Laughing Sigh — drops fear-based hook then dissolves tension with a half-laugh exhale",
        "Eyebrow Punctuation — left eyebrow raises exactly on punchlines, 0.3s before the word lands",
        "Proximity Pull — leans 4 inches closer to camera when shifting from information to opinion",
        "The Trailing Pause — ends key sentences with '...' and lets 1.5s of silence carry the weight",
    ],
    "emotional_range": [
        "fear_to_humor — 68% of videos use this arc",
        "curiosity_to_revelation — used in tutorial content",
        "vulnerability_to_strength — used in personal stories",
    ],
    "pacing_style": "Rapid-fire opening (first 3s), strategic slowdown at midpoint, accelerating close. Average hook length: 1.8 seconds.",
    "humor_style": "Dry delivery with deadpan setup → eyebrow raise → half-smile. Never laughs at own jokes. Humor lands through contrast, not emphasis.",
    "audience_relationship": "Trusted insider — 'I figured this out so you don't have to.' Frames authority through personal failure stories.",
    "hook_patterns": [
        {"type": "direct_address", "frequency": "45%", "example": "Nobody is talking about this."},
        {"type": "curiosity_gap", "frequency": "30%", "example": "I spent 6 months testing this and..."},
        {"type": "authority_frame", "frequency": "25%", "example": "As someone who lost $40k doing this..."},
    ],
    "delivery_notes": {
        "opening_energy": "8/10 — always starts high, voice slightly elevated",
        "camera_presence": "Direct eye contact, minimal blinking during hooks",
        "hand_gestures": "Counting fingers for lists, open palm for emphasis",
        "background_consistency": "Minimal — blurred home office, focus stays on face",
    },
    "content_themes": ["AI/tech commentary", "creator economy", "productivity tools", "contrarian takes"],
    "created_at": 1710460800,
    "updated_at": 1710547200,
}


def ensure_demo_profile():
    path = _profile_path("demo_creator")
    if not path.exists():
        # Copy to avoid mutating the module-level constant
        save_profile("demo_creator", {**DEMO_PROFILE})
    return load_profile("demo_creator") or DEMO_PROFILE
