"""Cadence - FastAPI server with WebSocket bidirectional streaming."""

import asyncio
import base64
import json
import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

load_dotenv(Path(__file__).parent / ".env")

from cadence_agents.agent import agent  # noqa: E402
from profiles import ensure_demo_profile, list_profiles, load_profile, save_profile  # noqa: E402

logger = logging.getLogger("cadence")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Cadence",
    description="AI Creative Director - learns your delivery, co-creates in your voice",
    version="1.0.0",
)

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

APP_NAME = "cadence"
session_service = InMemorySessionService()
runner = Runner(
    app_name=APP_NAME,
    agent=agent,
    session_service=session_service,
)


@app.get("/")
async def root():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "cadence"}


# --- Voice Profile API ---


class ProfileData(BaseModel):
    profile: dict


@app.get("/api/profiles")
async def get_profiles():
    return {"profiles": list_profiles()}


@app.get("/api/profiles/{user_id}")
async def get_profile(user_id: str):
    profile = load_profile(user_id)
    if not profile:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return {"profile": profile}


@app.post("/api/profiles/{user_id}")
async def update_profile(user_id: str, data: ProfileData):
    saved = save_profile(user_id, data.profile)
    return {"profile": saved}


@app.get("/api/demo-profile")
async def get_demo_profile():
    return {"profile": ensure_demo_profile()}


@app.websocket("/ws/{user_id}/{session_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, session_id: str):
    """Bidirectional WebSocket for live audio/video/text streaming."""
    await websocket.accept()
    logger.info("WebSocket connected: user=%s session=%s", user_id, session_id)

    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=[types.Modality.AUDIO],
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Puck"
                )
            ),
            language_code="en-US",
        ),
    )

    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if not session:
        session = await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )

    live_request_queue = LiveRequestQueue()
    is_closed = False

    # Inject existing voice profile as context if available
    profile = load_profile(user_id)
    if profile:
        profile_parts = []
        sessions = profile.get("sessions_completed", 0)
        name = profile.get("creator_name", "this creator")

        # Inject the structured voice profile — this is what powers personalized scripts
        if profile.get("signature_moves"):
            moves = "\n".join(f"- {m}" for m in profile["signature_moves"])
            profile_parts.append(f"SIGNATURE MOVES:\n{moves}")
        if profile.get("pacing_style"):
            profile_parts.append(f"PACING STYLE: {profile['pacing_style']}")
        if profile.get("humor_style"):
            profile_parts.append(f"HUMOR STYLE: {profile['humor_style']}")
        if profile.get("audience_relationship"):
            profile_parts.append(f"AUDIENCE RELATIONSHIP: {profile['audience_relationship']}")
        if profile.get("emotional_range"):
            ranges = "\n".join(f"- {r}" for r in profile["emotional_range"])
            profile_parts.append(f"EMOTIONAL RANGE:\n{ranges}")
        if profile.get("hook_patterns"):
            hooks = "\n".join(
                f"- {h.get('type', 'unknown')} ({h.get('frequency', '?')}): \"{h.get('example', '')}\""
                for h in profile["hook_patterns"]
            )
            profile_parts.append(f"HOOK PATTERNS:\n{hooks}")
        if profile.get("delivery_notes") and isinstance(profile["delivery_notes"], dict):
            notes = "\n".join(f"- {k}: {v}" for k, v in profile["delivery_notes"].items())
            profile_parts.append(f"DELIVERY NOTES:\n{notes}")

        # Also include recent session observations
        observations = profile.get("session_observations", [])
        if observations:
            obs_text = "\n".join(f"- {o}" for o in observations[-10:])
            profile_parts.append(f"RECENT SESSION OBSERVATIONS:\n{obs_text}")

        if profile_parts:
            full_profile = "\n\n".join(profile_parts)
            profile_context = types.Content(
                role="user",
                parts=[types.Part(text=(
                    f"[SYSTEM: Voice profile for {name} — {sessions} previous sessions.\n\n"
                    f"{full_profile}\n\n"
                    f"USE THIS PROFILE when writing scripts, giving feedback, or coaching delivery. "
                    f"Scripts MUST incorporate these signature moves, pacing patterns, and hook styles. "
                    f"This is what makes content sound like THIS creator, not generic.]"
                ))],
            )
            live_request_queue.send_content(profile_context)

    # Kickstart: greet and guide the user
    kickstart = types.Content(
        role="user",
        parts=[types.Part(text=(
            "[Session started. You can HEAR audio from the creator's screen (videos "
            "playing, etc.) and you can HEAR the creator speaking via microphone. "
            "Both audio streams come through together. Give a brief warm greeting "
            "(2 sentences max). Tell them to play one of their videos so you can "
            "listen to their delivery. Then WAIT for them to play something or talk to you.]"
        ))],
    )
    live_request_queue.send_content(kickstart)

    async def upstream_task():
        try:
            while True:
                message = await websocket.receive()

                if message.get("type") == "websocket.disconnect":
                    break

                try:
                    if "bytes" in message:
                        raw = message["bytes"]
                        # Audio streams are tagged with a 1-byte prefix:
                        # 0x01 = mic audio, 0x02 = tab/screen audio
                        if len(raw) > 1 and raw[0] in (0x01, 0x02):
                            audio_data = raw[1:]
                        else:
                            audio_data = raw
                        audio_blob = types.Blob(
                            mime_type="audio/pcm;rate=16000",
                            data=audio_data,
                        )
                        live_request_queue.send_realtime(audio_blob)

                    elif "text" in message:
                        data = json.loads(message["text"])
                        msg_type = data.get("type", "")

                        if msg_type == "text":
                            content = types.Content(
                                role="user",
                                parts=[types.Part(text=data["text"])],
                            )
                            live_request_queue.send_content(content)

                        elif msg_type == "image":
                            image_data = base64.b64decode(data["data"])
                            image_blob = types.Blob(
                                mime_type=data.get("mimeType", "image/jpeg"),
                                data=image_data,
                            )
                            live_request_queue.send_realtime(image_blob)

                except (json.JSONDecodeError, KeyError, ValueError) as e:
                    logger.warning("Skipping malformed message: %s", e)
                    continue

        except WebSocketDisconnect:
            logger.info("Upstream: WebSocket disconnected")
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Upstream error")

    async def downstream_task():
        nonlocal is_closed
        try:
            async for event in runner.run_live(
                user_id=user_id,
                session_id=session_id,
                live_request_queue=live_request_queue,
                run_config=run_config,
            ):
                if is_closed:
                    break
                try:
                    event_json = event.model_dump_json(
                        exclude_none=True, by_alias=True
                    )
                    await websocket.send_text(event_json)
                except (WebSocketDisconnect, RuntimeError):
                    break
                except Exception:
                    logger.exception("Error sending event")
                    break
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Downstream error")

    up = asyncio.create_task(upstream_task())
    down = asyncio.create_task(downstream_task())
    try:
        # Wait for either task to finish, then cancel the other
        done, pending = await asyncio.wait(
            [up, down], return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
    except WebSocketDisconnect:
        logger.info("Session ended: %s", session_id)
    finally:
        is_closed = True
        live_request_queue.close()
        logger.info("Cleaned up: %s", session_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
