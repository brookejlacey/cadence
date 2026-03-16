"""Cadence - Content analysis tools for learning creator voice and delivery."""


def analyze_delivery(transcript: str, context: str = "") -> dict:
    """Analyze the delivery patterns in a creator's content.

    Examines pacing, tone shifts, humor placement, emotional beats,
    and the relationship between what is said and how it lands.

    Args:
        transcript: The spoken words from the content.
        context: Visual/contextual notes about what was happening on screen.

    Returns:
        A structured analysis of delivery patterns.
    """
    patterns = {
        "hooks": [],
        "tone_shifts": [],
        "humor_beats": [],
        "pacing_notes": [],
        "signature_moves": [],
    }

    lines = transcript.strip().split("\n")

    # Detect hook patterns (first 3 seconds / first line)
    if lines:
        first_line = lines[0].strip().lower()
        if any(w in first_line for w in ["here's", "listen", "ok so", "the thing", "nobody"]):
            patterns["hooks"].append({
                "type": "direct_address",
                "text": lines[0],
                "note": "Opens with conversational authority - pulls viewer in immediately",
            })
        if "?" in first_line:
            patterns["hooks"].append({
                "type": "question_hook",
                "text": lines[0],
                "note": "Opens with a question - creates curiosity gap",
            })

    # Detect tone shifts (fear -> humor, serious -> soft)
    fear_words = {"scared", "terrifying", "dangerous", "threat", "replace", "gone", "dead", "end"}
    humor_words = {"laugh", "funny", "joke", "honestly", "literally", "wild", "insane", "lol"}
    soft_words = {"but", "here's the thing", "and yet", "still", "okay", "breathe"}

    for i, line in enumerate(lines):
        lower = line.lower()
        has_fear = any(w in lower for w in fear_words)
        has_humor = any(w in lower for w in humor_words)
        has_soft = any(w in lower for w in soft_words)

        if has_fear and has_humor:
            patterns["tone_shifts"].append({
                "line": i + 1,
                "type": "fear_to_humor",
                "text": line,
                "note": "Combines threat with levity - the 'laughing sigh' pattern",
            })
        if has_fear and has_soft:
            patterns["tone_shifts"].append({
                "line": i + 1,
                "type": "fear_to_safety",
                "text": line,
                "note": "Introduces danger then immediately offers shelter",
            })

    # Detect pacing cues
    for i, line in enumerate(lines):
        if line.strip().endswith("...") or line.strip().endswith("—"):
            patterns["pacing_notes"].append({
                "line": i + 1,
                "type": "trailing_pause",
                "note": "Natural pause point - lets the weight land before continuing",
            })
        if len(line.split()) <= 4 and line.strip():
            patterns["pacing_notes"].append({
                "line": i + 1,
                "type": "short_punch",
                "text": line.strip(),
                "note": "Short line for emphasis - delivery should be slower, deliberate",
            })

    return {
        "pattern_count": sum(len(v) for v in patterns.values()),
        "patterns": patterns,
        "summary": f"Found {sum(len(v) for v in patterns.values())} delivery patterns across {len(lines)} lines.",
    }


def analyze_hook(text: str) -> dict:
    """Analyze the opening hook of a piece of content.

    Args:
        text: The first few seconds / opening lines of content.

    Returns:
        Analysis of what makes the hook work (or not).
    """
    words = text.split()
    result = {
        "word_count": len(words),
        "hook_type": "unknown",
        "strength": "medium",
        "notes": [],
    }

    lower = text.lower()

    if len(words) <= 8:
        result["notes"].append("Tight hook - gets to the point fast")
        result["strength"] = "strong"

    if lower.startswith(("i ", "i'm ", "i've ")):
        result["hook_type"] = "personal_story"
        result["notes"].append("Personal opener - creates immediate intimacy")

    if "you" in lower.split()[:5]:
        result["hook_type"] = "direct_address"
        result["notes"].append("Addresses viewer directly - breaks fourth wall immediately")

    if "?" in text:
        result["hook_type"] = "curiosity_gap"
        result["notes"].append("Question creates open loop - viewer stays to get the answer")

    if any(w in lower for w in ["never", "nobody", "everyone", "always", "impossible"]):
        result["notes"].append("Absolute language creates stakes and urgency")
        result["strength"] = "strong"

    if any(w in lower for w in ["secret", "truth", "real reason", "what they"]):
        result["notes"].append("Insider knowledge framing - positions creator as authority")
        result["strength"] = "strong"

    return result


def compare_styles(style_a: str, style_b: str) -> dict:
    """Compare two content styles or delivery approaches.

    Args:
        style_a: Description of the first style/approach.
        style_b: Description of the second style/approach.

    Returns:
        Comparison highlighting similarities and differences.
    """
    return {
        "style_a": style_a,
        "style_b": style_b,
        "analysis": "Compare delivery pacing, emotional range, humor style, and audience relationship.",
        "note": "Use this to help the creator understand how their style differs from trends.",
    }


def generate_script_notes(script: str, voice_profile: str = "") -> dict:
    """Generate performance/delivery notes for a script based on a creator's voice profile.

    Args:
        script: The script text to annotate.
        voice_profile: Description of the creator's delivery style and signature moves.

    Returns:
        The script with line-by-line delivery directions.
    """
    lines = script.strip().split("\n")
    annotated = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue

        notes = []
        lower = stripped.lower()

        # Detect where delivery notes should go
        if len(stripped.split()) <= 5:
            notes.append("DELIVERY: Slow down. Let this line breathe.")
        if stripped.endswith("..."):
            notes.append("DELIVERY: Trail off. The silence IS the punchline.")
        if stripped.endswith("?"):
            notes.append("DELIVERY: Raise pitch slightly. Lean into camera.")
        if any(w in lower for w in ["scared", "terrified", "dangerous", "threat"]):
            notes.append("DELIVERY: Voice drops. Serious. Then soften at the end — the laughing sigh.")
        if any(w in lower for w in ["but", "except", "here's the thing"]):
            notes.append("DELIVERY: Pause BEFORE this line. Let them sit in the tension. Then pivot.")
        if stripped.startswith(("And ", "But ", "So ")):
            notes.append("DELIVERY: Quick cut energy. No pause before — slam into it.")

        annotated.append({
            "line_number": i + 1,
            "text": stripped,
            "delivery_notes": notes if notes else ["DELIVERY: Natural pace. Conversational."],
        })

    return {
        "line_count": len(annotated),
        "annotated_script": annotated,
        "voice_profile_used": voice_profile or "generic",
    }


def extract_voice_profile(observations: str) -> dict:
    """Extract a structured voice profile from observations about a creator's content.

    Args:
        observations: Free-form notes about what was observed in the creator's videos.

    Returns:
        A structured voice profile capturing the creator's unique delivery signature.
    """
    profile = {
        "signature_moves": [],
        "emotional_range": [],
        "pacing_style": "",
        "humor_style": "",
        "audience_relationship": "",
        "raw_observations": observations,
    }

    lower = observations.lower()

    if "pause" in lower or "silence" in lower or "wait" in lower:
        profile["signature_moves"].append("Strategic silence — uses pauses as emphasis")
    if "eye" in lower or "look" in lower or "expression" in lower:
        profile["signature_moves"].append("Facial counterpoint — face says something different than words")
    if "laugh" in lower or "smile" in lower or "grin" in lower:
        profile["signature_moves"].append("Tension release — humor as safety valve after heavy content")
    if "lean" in lower or "close" in lower or "camera" in lower:
        profile["signature_moves"].append("Proximity shift — moves closer to camera for emphasis")
    if "fast" in lower or "rapid" in lower or "quick" in lower:
        profile["pacing_style"] = "rapid-fire with strategic slowdowns"
    if "slow" in lower or "deliberate" in lower:
        profile["pacing_style"] = "deliberate and measured with sharp accelerations"
    if "sarcas" in lower or "deadpan" in lower or "dry" in lower:
        profile["humor_style"] = "dry/deadpan — humor comes from delivery, not the words themselves"
    if "warm" in lower or "safe" in lower or "trust" in lower:
        profile["audience_relationship"] = "trusted guide — 'I've been through this, come with me'"

    return profile
