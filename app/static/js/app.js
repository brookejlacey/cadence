/**
 * Cadence - AI Creative Director
 * Learns your delivery, co-creates in your voice.
 */
import { AudioPlayer } from "./audio-player.js";

// --- Particle background ---

class ParticleField {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.particles = [];
        this.mouse = { x: -1000, y: -1000 };
        this.resize();
        window.addEventListener("resize", () => this.resize());
        document.addEventListener("mousemove", (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        this.init();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    init() {
        const count = Math.min(60, Math.floor((this.canvas.width * this.canvas.height) / 22000));
        this.particles = Array.from({ length: count }, () => ({
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: (Math.random() - 0.5) * 0.25,
            vy: (Math.random() - 0.5) * 0.25,
            r: Math.random() * 1.5 + 0.5,
            alpha: Math.random() * 0.25 + 0.08,
        }));
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const { width, height } = this.canvas;

        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            const dx = p.x - this.mouse.x;
            const dy = p.y - this.mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const glow = dist < 150 ? (1 - dist / 150) * 0.3 : 0;

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(0, 210, 210, ${p.alpha + glow})`;
            this.ctx.fill();
        }

        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const a = this.particles[i];
                const b = this.particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(a.x, a.y);
                    this.ctx.lineTo(b.x, b.y);
                    this.ctx.strokeStyle = `rgba(0, 210, 210, ${0.04 * (1 - dist / 100)})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            }
        }

        requestAnimationFrame(() => this.animate());
    }
}

// --- Typewriter ---

class Typewriter {
    constructor(element, phrases, speed = 40, pause = 2500) {
        this.el = element;
        this.phrases = phrases;
        this.speed = speed;
        this.pause = pause;
        this.idx = 0;
        this.charIdx = 0;
        this.deleting = false;
        this.tick();
    }

    tick() {
        const phrase = this.phrases[this.idx];
        if (this.deleting) {
            this.charIdx--;
            this.el.textContent = phrase.substring(0, this.charIdx);
            if (this.charIdx === 0) {
                this.deleting = false;
                this.idx = (this.idx + 1) % this.phrases.length;
                setTimeout(() => this.tick(), 300);
                return;
            }
            setTimeout(() => this.tick(), 20);
        } else {
            this.charIdx++;
            this.el.textContent = phrase.substring(0, this.charIdx);
            if (this.charIdx === phrase.length) {
                this.deleting = true;
                setTimeout(() => this.tick(), this.pause);
                return;
            }
            setTimeout(() => this.tick(), this.speed);
        }
    }
}

// --- Markdown rendering ---

function renderMarkdown(text) {
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code class="language-${lang || 'text'}">${escapeHtml(code.trim())}</code></pre>`;
    });
    text = text.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);
    text = text.replace(/(<pre><code[^>]*>[\s\S]*?<\/code><\/pre>|<code>[\s\S]*?<\/code>)/g, (match) => {
        return '\0CODE' + match + 'CODE\0';
    });
    const parts = text.split(/\0CODE([\s\S]*?)CODE\0/);
    text = parts.map((part, i) => i % 2 === 0 ? escapeHtml(part) : part).join('');
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return text;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// --- Insights panel ---

class InsightsPanel {
    constructor() {
        this.panel = document.getElementById("insights-panel");
        this.body = document.getElementById("insights-body");
        this.toggle = document.getElementById("insights-toggle");
        this.profileContent = document.getElementById("profile-content");
        this.patternsContent = document.getElementById("patterns-content");
        this.hooksContent = document.getElementById("hooks-content");
        this.deliveryContent = document.getElementById("delivery-content");

        this.patterns = [];
        this.hooks = [];
        this.deliveryNotes = [];
        this.profile = null;

        this.toggle?.addEventListener("click", () => this.togglePanel());
    }

    togglePanel() {
        const container = document.querySelector(".main-container");
        container.classList.toggle("insights-visible");
    }

    loadProfile(profile) {
        this.profile = profile;
        if (!profile || !this.profileContent) return;

        let html = "";

        if (profile.creator_name) {
            html += `<div class="insight-item"><span class="insight-label">Creator</span><span class="insight-value">${escapeHtml(profile.creator_name)}</span></div>`;
        }

        if (profile.videos_analyzed) {
            const pct = Math.min(100, Number(profile.videos_analyzed) * 8);
            html += `<div class="profile-progress"><span class="profile-progress-label">Videos studied</span><div class="profile-progress-bar"><div class="profile-progress-fill" style="width: ${pct}%"></div></div><span class="profile-progress-value">${Number(profile.videos_analyzed)}</span></div>`;
        }

        if (profile.signature_moves?.length) {
            html += `<div class="insight-item"><span class="insight-label">Signature Moves</span>`;
            for (const move of profile.signature_moves) {
                html += `<span class="insight-tag signature">${escapeHtml(this._truncate(move, 40))}</span>`;
            }
            html += `</div>`;
        }

        if (profile.pacing_style) {
            html += `<div class="insight-item"><span class="insight-label">Pacing</span><span class="insight-value">${escapeHtml(profile.pacing_style)}</span></div>`;
        }

        if (profile.humor_style) {
            html += `<div class="insight-item"><span class="insight-label">Humor</span><span class="insight-value">${escapeHtml(profile.humor_style)}</span></div>`;
        }

        this.profileContent.innerHTML = html || '<div class="insight-empty">No profile loaded</div>';
    }

    addPattern(type, description) {
        this.patterns.push({ type, description, time: Date.now() });
        this._renderPatterns();
    }

    addHook(type, strength, notes) {
        this.hooks.push({ type, strength, notes, time: Date.now() });
        this._renderHooks();
    }

    addDeliveryNote(label, note) {
        this.deliveryNotes.push({ label, note, time: Date.now() });
        this._renderDelivery();
    }

    _renderPatterns() {
        if (!this.patternsContent) return;
        if (this.patterns.length === 0) {
            this.patternsContent.innerHTML = '<div class="insight-empty">Watching for patterns...</div>';
            return;
        }
        // Show most recent 10
        const recent = this.patterns.slice(-10).reverse();
        this.patternsContent.innerHTML = recent.map(p =>
            `<div class="insight-item"><span class="insight-tag pattern">${escapeHtml(p.type)}</span> ${escapeHtml(p.description)}</div>`
        ).join("");
    }

    _renderHooks() {
        if (!this.hooksContent) return;
        if (this.hooks.length === 0) {
            this.hooksContent.innerHTML = '<div class="insight-empty">No hooks analyzed yet</div>';
            return;
        }
        const recent = this.hooks.slice(-5).reverse();
        this.hooksContent.innerHTML = recent.map(h => {
            const strengthClass = h.strength === "strong" ? "signature" : "hook";
            return `<div class="insight-item"><span class="insight-tag ${strengthClass}">${escapeHtml(h.type)}</span><span class="insight-tag hook">${escapeHtml(h.strength)}</span><br>${h.notes.map(n => escapeHtml(n)).join("<br>")}</div>`;
        }).join("");
    }

    _renderDelivery() {
        if (!this.deliveryContent) return;
        if (this.deliveryNotes.length === 0) {
            this.deliveryContent.innerHTML = '<div class="insight-empty">Observing delivery...</div>';
            return;
        }
        const recent = this.deliveryNotes.slice(-8).reverse();
        this.deliveryContent.innerHTML = recent.map(d =>
            `<div class="insight-item"><span class="insight-label">${escapeHtml(d.label)}</span><span class="insight-value">${escapeHtml(d.note)}</span></div>`
        ).join("");
    }

    reset() {
        this.patterns = [];
        this.hooks = [];
        this.deliveryNotes = [];
        this.profile = null;
        this._renderPatterns();
        this._renderHooks();
        this._renderDelivery();
        if (this.profileContent) {
            this.profileContent.innerHTML = '<div class="insight-empty">No profile loaded</div>';
        }
    }

    _truncate(str, len) {
        return str.length > len ? str.substring(0, len) + "..." : str;
    }
}

// --- Main app ---

class Cadence {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.isScreenSharing = false;
        this.isMicActive = false;
        this.screenStream = null;
        this.captureInterval = null;
        this.captureCanvas = document.createElement("canvas");
        this.captureCtx = this.captureCanvas.getContext("2d");

        this.stats = {
            startTime: null,
            messages: 0,
            frames: 0,
        };
        this.durationInterval = null;

        this.audioPlayer = new AudioPlayer();
        this._cadenceResponseCount = 0;
        this.audioPlayer.onPlaybackEnd = () => {
            this.stopAvatarPulse();
            this._flushCadenceTranscript();
            // Show contextual chips after Cadence finishes speaking
            this._cadenceResponseCount++;
            if (this._cadenceResponseCount === 1) {
                // After first response (greeting), show watching chips
                setTimeout(() => this._showPhaseChips("watching"), 1000);
            } else if (this._cadenceResponseCount >= 2) {
                // After subsequent responses, show analysis/scout chips
                setTimeout(() => this._showPhaseChips("analyzed"), 1500);
            }
        };
        this.insights = new InsightsPanel();

        // DOM refs
        this.statusDot = document.getElementById("status-dot");
        this.statusText = document.getElementById("status-text");
        this.statusBadge = document.getElementById("status-badge");
        this.startBtn = document.getElementById("start-btn");
        this.demoBtn = document.getElementById("demo-btn");
        this.stopBtn = document.getElementById("stop-btn");
        this.micBtn = document.getElementById("mic-btn");
        this.textInput = document.getElementById("text-input");
        this.sendBtn = document.getElementById("send-btn");
        this.transcript = document.getElementById("transcript");
        this.screenPreview = document.getElementById("screen-preview");
        this.directorAvatar = document.getElementById("director-avatar");
        this.modeBar = document.getElementById("mode-bar");
        this.liveBadge = document.getElementById("live-badge");
        this.emptyState = document.getElementById("empty-state");
        this.placeholder = document.getElementById("screen-placeholder");

        // Events
        this.startBtn.addEventListener("click", () => this.startSession());
        this.demoBtn.addEventListener("click", () => this.startDemo());
        this.stopBtn.addEventListener("click", () => this.stopSession());
        this.micBtn.addEventListener("click", () => this.toggleMic());
        this.sendBtn.addEventListener("click", () => this.sendText());
        this.textInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendText();
            }
        });

        document.addEventListener("keydown", (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "m") {
                e.preventDefault();
                if (!this.micBtn.disabled) this.toggleMic();
            }
        });

        // Init particles
        const particleCanvas = document.getElementById("particles");
        if (particleCanvas) new ParticleField(particleCanvas);

        // Init typewriter
        const twEl = document.getElementById("typewriter-text");
        if (twEl) {
            new Typewriter(twEl, [
                "Show me your videos. I'll learn your delivery.",
                "I watch micro-expressions, not just words.",
                "Your performance is the dataset. Let me study it.",
                "Every pause. Every eyebrow. Every tone shift. I'm watching.",
                "The future of AI isn't replacing expression. It's learning it.",
            ]);
        }

        this.setStatus("idle", "Ready");
    }

    // --- Session lifecycle ---

    async startSession() {
        try {
            this.setStatus("connecting", "Starting...");

            this.stats = { startTime: null, messages: 0, frames: 0 };

            this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: { max: 5 }, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: true,
            });

            this.screenPreview.srcObject = this.screenStream;
            this.isScreenSharing = true;

            // Initialize audio player early (before WS connect) to avoid
            // jank when first audio arrives during video playback
            await this.audioPlayer.initialize();

            this.screenStream.getVideoTracks()[0].addEventListener("ended", () => {
                this.stopSession();
            });

            // Persist userId across sessions so voice profiles accumulate
            this.userId = localStorage.getItem("cadence_user_id");
            if (!this.userId) {
                this.userId = "user_" + Math.random().toString(36).substring(2, 10);
                localStorage.setItem("cadence_user_id", this.userId);
            }
            this.sessionId = "session_" + Date.now();
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            const wsUrl = `${protocol}//${window.location.host}/ws/${this.userId}/${this.sessionId}`;

            this.ws = new WebSocket(wsUrl);
            this.ws.binaryType = "arraybuffer";

            this.ws.onopen = async () => {
                this.isConnected = true;
                this.setStatus("connected", "Cadence is watching");
                this.startBtn.classList.add("hidden");
                this.demoBtn.classList.add("hidden");
                this.stopBtn.classList.remove("hidden");
                this.micBtn.disabled = false;

                await this.audioPlayer.resume();
                // Start mixed audio: mic + tab audio in one stream
                await this.startMixedAudio();
                // Screen frames kept for future multimodal models
                this.startScreenCapture();

                this.stats.startTime = Date.now();
                this.modeBar.classList.add("visible");
                this.statusBadge.classList.add("active");
                this.liveBadge.classList.add("visible");
                this.durationInterval = setInterval(() => this.updateDuration(), 1000);

                if (this.emptyState) this.emptyState.style.display = "none";
                if (this.placeholder) this.placeholder.style.display = "none";

                this.addTranscriptEntry("system", "Session live. Play a video on your shared screen, then ask Cadence what it thinks.");

                // Load existing profile if one exists for this user
                fetch(`/api/profiles/${this.userId}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(data => { if (data?.profile) this.insights.loadProfile(data.profile); })
                    .catch(() => {});
            };

            this.ws.onmessage = (event) => this.handleServerMessage(event);

            this.ws.onclose = () => {
                if (this.isConnected) {
                    // Auto-reconnect instead of killing session
                    this._reconnect();
                }
            };

            this.ws.onerror = (err) => {
                console.error("WebSocket error:", err);
                this.setStatus("error", "Connection error");
            };
        } catch (err) {
            console.error("Failed to start:", err);
            this.setStatus("error", err.message || "Failed to start");
        }
    }

    stopSession() {
        // Always allow stop — don't gate on state flags that may be stale

        this._flushCadenceTranscript();
        this.isConnected = false;
        this._hideChips();
        clearTimeout(this._chipTimeout);
        clearTimeout(this._reconnectTimeout);
        this._saveSessionProfile();
        this.stopScreenCapture();
        if (this.screenStream) {
            this.screenStream.getTracks().forEach((t) => t.stop());
            this.screenStream = null;
        }
        this.screenPreview.srcObject = null;
        this.isScreenSharing = false;

        this.stopMixedAudio();
        this.audioPlayer.stop();
        this.insights.reset();

        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }

        this.startBtn.classList.remove("hidden");
        this.demoBtn.classList.remove("hidden");
        this.demoBtn.disabled = false;
        this.stopBtn.classList.add("hidden");
        this.micBtn.disabled = true;
        this.statusBadge.classList.remove("active");
        this.liveBadge.classList.remove("visible");
        this.modeBar.classList.remove("visible");
        this._setMode("study", "STUDY");
        this.setStatus("idle", "Session ended");

        if (this.durationInterval) {
            clearInterval(this.durationInterval);
            this.durationInterval = null;
        }

        // Restore empty state and placeholder
        if (this.emptyState) this.emptyState.style.display = "";
        if (this.placeholder) this.placeholder.style.display = "";

        // Clear transcript entries but keep the empty state element
        const entries = this.transcript.querySelectorAll(".transcript-entry");
        entries.forEach((e) => e.remove());
    }

    // --- Auto-reconnect with retry ---

    _reconnect() {
        if (!this.isConnected) return;
        if (!this._reconnectAttempts) this._reconnectAttempts = 0;
        this._reconnectAttempts++;

        // Give up after 5 attempts
        if (this._reconnectAttempts > 5) {
            this.addTranscriptEntry("system", "Connection lost. Click Stop and Start to begin a new session.");
            this._reconnectAttempts = 0;
            this.stopSession();
            return;
        }

        this.addTranscriptEntry("system", "Reconnecting...");
        this.setStatus("connecting", "Reconnecting...");

        // Close old socket cleanly
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.close();
        }

        // New session ID, same user ID (so profile persists)
        this.sessionId = "session_" + Date.now();
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws/${this.userId}/${this.sessionId}`;

        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = "arraybuffer";

        this.ws.onopen = () => {
            this._reconnectAttempts = 0; // Reset on successful connect
            this.setStatus("connected", "Cadence is watching");
            this.addTranscriptEntry("system", "Reconnected.");
        };

        this.ws.onmessage = (event) => this.handleServerMessage(event);

        this.ws.onclose = () => {
            if (this.isConnected) {
                // Exponential backoff: 2s, 4s, 6s, 8s, 10s
                const delay = this._reconnectAttempts * 2000;
                this._reconnectTimeout = setTimeout(() => {
                    if (this.isConnected) this._reconnect();
                }, delay);
            }
        };

        this.ws.onerror = () => {
            this.setStatus("error", "Reconnecting...");
        };
    }

    // --- Mixed audio: mic + tab audio combined into one stream ---
    // The native-audio model is audio-only. We mix mic and tab audio into
    // a single PCM stream so Gemini gets one coherent input (not two
    // competing streams that cause rate limit disconnects).

    async startMixedAudio() {
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        this.mixedAudioCtx = audioCtx;

        await audioCtx.audioWorklet.addModule("/static/js/pcm-recorder-processor.js");

        // Create a mixer (destination node we'll connect sources to)
        const mixer = audioCtx.createGain();
        mixer.gain.value = 1.0;

        // Source 1: Microphone
        try {
            const micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            this.micStream = micStream;
            const micSource = audioCtx.createMediaStreamSource(micStream);
            // Boost mic slightly so it's audible over video audio
            const micGain = audioCtx.createGain();
            micGain.gain.value = 1.5;
            micSource.connect(micGain);
            micGain.connect(mixer);
            this.micBtn.classList.add("active");
            document.getElementById("waveform-container")?.classList.add("visible");
        } catch (err) {
            console.warn("Mic not available:", err.message);
        }

        // Source 2: Tab audio (from screen share)
        const tabTracks = this.screenStream?.getAudioTracks() || [];
        if (tabTracks.length > 0) {
            const tabSource = audioCtx.createMediaStreamSource(
                new MediaStream([tabTracks[0]])
            );
            // Tab audio slightly quieter so mic comes through clearly
            const tabGain = audioCtx.createGain();
            tabGain.gain.value = 0.7;
            tabSource.connect(tabGain);
            tabGain.connect(mixer);
        }

        // Worklet captures the mixed output
        this.mixedWorklet = new AudioWorkletNode(audioCtx, "pcm-recorder-processor");
        mixer.connect(this.mixedWorklet);
        this.mixedWorklet.connect(audioCtx.destination);

        this.mixedWorklet.port.onmessage = (event) => {
            if (event.data.type !== "audio") return;
            if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

            // Convert Float32 to Int16 PCM
            const float32 = event.data.buffer;
            const int16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
                const s = Math.max(-1, Math.min(1, float32[i]));
                int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            this.ws.send(int16.buffer);
            this.updateWaveform(int16.buffer);
        };
    }

    stopMixedAudio() {
        if (this.mixedWorklet) {
            this.mixedWorklet.disconnect();
            this.mixedWorklet = null;
        }
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }
        if (this.mixedAudioCtx) {
            this.mixedAudioCtx.close();
            this.mixedAudioCtx = null;
        }
        this.micBtn.classList.remove("active");
        document.getElementById("waveform-container")?.classList.remove("visible");
    }

    // --- Screen capture ---

    startScreenCapture() {
        // Capture every 5 seconds — images are for future multimodal models,
        // current native-audio model only processes audio
        this.captureInterval = setInterval(() => this.captureFrame(), 5000);
        // Show suggestion chips after user has had time to play a video
        this._chipTimeout = setTimeout(() => this._showPhaseChips("watching"), 15000);
    }

    stopScreenCapture() {
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
    }

    captureFrame() {
        if (!this.screenStream || !this.isConnected) return;

        const track = this.screenStream.getVideoTracks()[0];
        if (!track || track.readyState !== "live") return;

        const settings = track.getSettings();
        const width = Math.min(settings.width || 1280, 1280);
        const height = Math.min(settings.height || 720, 720);
        const scale = Math.min(768 / width, 768 / height, 1);
        this.captureCanvas.width = Math.round(width * scale);
        this.captureCanvas.height = Math.round(height * scale);

        this.captureCtx.drawImage(
            this.screenPreview, 0, 0,
            this.captureCanvas.width, this.captureCanvas.height
        );

        this.captureCanvas.toBlob((blob) => {
            if (!blob || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(",")[1];
                this.ws.send(JSON.stringify({
                    type: "image",
                    data: base64,
                    mimeType: "image/jpeg",
                }));
                this.stats.frames++;
                this.updateStatDisplay("stat-frames", this.stats.frames);
            };
            reader.readAsDataURL(blob);
        }, "image/jpeg", 0.7);
    }

    // --- Audio ---

    async toggleMic() {
        // Mic is now managed by the mixed audio system.
        // This method handles the mic button toggle for mute/unmute.
        if (!this.mixedAudioCtx) return;

        if (this.micBtn.classList.contains("active")) {
            // Mute mic by stopping tracks
            if (this.micStream) {
                this.micStream.getAudioTracks().forEach(t => t.enabled = false);
            }
            this.micBtn.classList.remove("active");
            document.getElementById("waveform-container")?.classList.remove("visible");
        } else {
            if (this.micStream) {
                this.micStream.getAudioTracks().forEach(t => t.enabled = true);
            }
            this.micBtn.classList.add("active");
            document.getElementById("waveform-container")?.classList.add("visible");
        }
    }

    updateWaveform(pcmBuffer) {
        const canvas = document.getElementById("waveform");
        if (!canvas || !this.micBtn.classList.contains("active")) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const int16 = new Int16Array(pcmBuffer);

        const bars = 32;
        const step = Math.floor(int16.length / bars);
        const values = [];
        for (let i = 0; i < bars; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) {
                sum += Math.abs(int16[i * step + j] || 0);
            }
            values.push(sum / step / 0x8000);
        }

        const w = canvas.width = canvas.offsetWidth * 2;
        const h = canvas.height = canvas.offsetHeight * 2;
        ctx.clearRect(0, 0, w, h);

        const barWidth = w / bars - 2;
        for (let i = 0; i < bars; i++) {
            const barH = Math.max(2, values[i] * h * 2);
            const x = i * (barWidth + 2);
            const y = (h - barH) / 2;
            const gradient = ctx.createLinearGradient(0, y, 0, y + barH);
            gradient.addColorStop(0, "rgba(0, 210, 210, 0.8)");
            gradient.addColorStop(1, "rgba(0, 163, 204, 0.6)");
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barH, 2);
            ctx.fill();
        }
    }

    // --- Text chat ---

    sendText() {
        const text = this.textInput.value.trim();
        if (!text || !this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        this._hideChips();
        this.ws.send(JSON.stringify({ type: "text", text }));
        this.addTranscriptEntry("user", text);
        this.textInput.value = "";
        this.stats.messages++;
        this.updateStatDisplay("stat-messages", this.stats.messages);
    }

    // --- Server messages ---

    handleServerMessage(event) {
        if (event.data instanceof ArrayBuffer) return;

        try {
            const data = JSON.parse(event.data);

            // ADK sends camelCase field names (by_alias=True)
            if (data.content?.parts) {
                for (const part of data.content.parts) {
                    const inlineData = part.inlineData || part.inline_data;
                    if (inlineData?.data) {
                        // Gemini sends URL-safe base64 (- and _ instead of + and /)
                        const b64 = inlineData.data.replace(/-/g, "+").replace(/_/g, "/");
                        try {
                            const audioBytes = Uint8Array.from(
                                atob(b64),
                                (c) => c.charCodeAt(0)
                            );
                            this.audioPlayer.playChunk(audioBytes.buffer);
                            this.pulseAvatar();
                        } catch (_) {
                            // Skip malformed audio chunks
                        }
                    }
                    const fnResponse = part.functionResponse || part.function_response;
                    if (fnResponse) {
                        this._handleToolResult(fnResponse);
                    }
                }
            }

            // Voice is the primary output — don't transcribe to chat.
            // The chat panel is for typed messages, system info, and chips only.
            // Gemini's BIDI transcription is too unreliable for display.

            if (data.interrupted) {
                this._flushCadenceTranscript();
                this.audioPlayer.clear();
                this.stopAvatarPulse();
            }
        } catch (err) {
            console.error("Error handling message:", err);
        }
    }

    _flushCadenceTranscript() {
        // No-op — voice transcription is no longer displayed in chat
    }

    addTranscriptEntry(role, text) {
        const cssClass = role === "cadence" ? "cadence" : role === "system" ? "system" : "user";
        const label = role === "cadence" ? "Cadence" : role === "system" ? "System" : "You";

        const entry = document.createElement("div");
        entry.className = `transcript-entry ${cssClass}`;
        entry.innerHTML = `
            <span class="transcript-role">${label}</span>
            <span class="transcript-text">${renderMarkdown(text)}</span>
        `;
        this.transcript.appendChild(entry);
        this.transcript.scrollTop = this.transcript.scrollHeight;
    }

    // --- Tool result parsing for insights ---

    _handleToolResult(fnResponse) {
        try {
            const name = fnResponse.name;
            const result = typeof fnResponse.response === "string"
                ? JSON.parse(fnResponse.response)
                : fnResponse.response;

            if (name === "analyze_delivery" && result?.patterns) {
                const p = result.patterns;
                for (const hook of (p.hooks || [])) {
                    this.insights.addPattern("hook", hook.note || hook.type);
                }
                for (const shift of (p.tone_shifts || [])) {
                    this.insights.addPattern("tone_shift", shift.note || shift.type);
                }
                for (const note of (p.pacing_notes || [])) {
                    this.insights.addPattern("pacing", note.note || note.type);
                }
                for (const move of (p.signature_moves || [])) {
                    this.insights.addPattern("signature", move.note || move);
                }
            }

            if (name === "analyze_hook" && result) {
                this.insights.addHook(
                    result.hook_type || "unknown",
                    result.strength || "medium",
                    result.notes || []
                );
            }

            if (name === "extract_voice_profile" && result) {
                for (const move of (result.signature_moves || [])) {
                    this.insights.addDeliveryNote("Signature", move);
                }
                if (result.pacing_style) {
                    this.insights.addDeliveryNote("Pacing", result.pacing_style);
                }
                if (result.humor_style) {
                    this.insights.addDeliveryNote("Humor", result.humor_style);
                }
            }

            if (name === "generate_script_notes" && result?.annotated_script) {
                for (const line of result.annotated_script.slice(0, 3)) {
                    for (const note of (line.delivery_notes || [])) {
                        this.insights.addDeliveryNote(`L${line.line_number}`, note);
                    }
                }
            }
        } catch (e) {
            // Silently ignore parse errors from tool results
        }
    }

    // --- Demo mode ---

    async startDemo() {
        if (this.demoBtn.disabled) return;
        this.demoBtn.disabled = true;
        try {
            const resp = await fetch("/api/demo-profile");
            const data = await resp.json();
            const profile = data.profile;

            // Clear previous demo data to avoid accumulation on repeated clicks
            this.insights.reset();
            const prevEntries = this.transcript.querySelectorAll(".transcript-entry");
            prevEntries.forEach((e) => e.remove());

            this.insights.loadProfile(profile);

            // Populate the insights panel with demo data
            this.insights.addPattern("hook", "Opens with conversational authority — direct address hook");
            this.insights.addPattern("tone_shift", "Fear-to-humor arc — the 'laughing sigh' pattern");
            this.insights.addPattern("pacing", "1.8s hook average — rapid-fire opening");
            this.insights.addPattern("signature", "Eyebrow punctuation — left eyebrow raises on punchlines");
            this.insights.addPattern("pacing", "Strategic slowdown at midpoint before accelerating close");

            this.insights.addHook("direct_address", "strong", [
                "Tight hook — gets to the point fast",
                "Addresses viewer directly — breaks fourth wall immediately",
                "Absolute language creates stakes and urgency",
            ]);
            this.insights.addHook("curiosity_gap", "strong", [
                "Question creates open loop — viewer stays to get the answer",
                "Personal opener — creates immediate intimacy",
            ]);

            this.insights.addDeliveryNote("Signature", "The Laughing Sigh — dissolves tension with half-laugh exhale");
            this.insights.addDeliveryNote("Signature", "Proximity Pull — leans closer on opinion shifts");
            this.insights.addDeliveryNote("Camera", "Direct eye contact, minimal blinking during hooks");
            this.insights.addDeliveryNote("Energy", "8/10 opening energy — voice slightly elevated");
            this.insights.addDeliveryNote("Pacing", "Rapid-fire → strategic slowdown → accelerating close");

            this.addTranscriptEntry("system", `Demo mode: Loaded voice profile for ${profile.creator_name}. ${profile.videos_analyzed} videos analyzed across ${profile.sessions_completed} sessions.`);
            this.addTranscriptEntry("cadence", `I know this creator. ${profile.creator_name} — the laughing sigh, the eyebrow punctuation, the way they lean in right when they shift from facts to opinion. ${profile.videos_analyzed} videos deep. Show me something new and I'll tell you how it fits the pattern.`);

            if (this.emptyState) this.emptyState.style.display = "none";

            // Re-enable after a short delay so it doesn't look like a misclick
            setTimeout(() => { this.demoBtn.disabled = false; }, 2000);

        } catch (err) {
            console.error("Demo mode error:", err);
            this.demoBtn.disabled = false;
            this.addTranscriptEntry("system", "Failed to load demo profile.");
        }
    }

    // --- Suggestion chips ---

    _showChips(chips) {
        const container = document.getElementById("suggestion-chips");
        if (!container) return;
        container.innerHTML = "";
        for (const chip of chips) {
            const btn = document.createElement("button");
            btn.className = "suggestion-chip";
            btn.textContent = chip;
            btn.addEventListener("click", () => {
                this._hideChips();
                if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    // Send with a system directive so the model switches tasks
                    const directive = `[INSTRUCTION: The creator is asking you to change what you're doing. Stop analyzing delivery and respond to this request directly.]\n\n${chip}`;
                    this.ws.send(JSON.stringify({ type: "text", text: directive }));
                    this.addTranscriptEntry("user", chip);
                    this.stats.messages++;
                    this.updateStatDisplay("stat-messages", this.stats.messages);
                }
            });
            container.appendChild(btn);
        }
        container.classList.add("visible");
    }

    _hideChips() {
        const container = document.getElementById("suggestion-chips");
        if (container) {
            container.classList.remove("visible");
            container.innerHTML = "";
        }
    }

    _showNextChips(cadenceText) {
        const lower = cadenceText.toLowerCase();
        // After trend/viral discussion, offer script and deeper exploration
        if (lower.includes("trending") || lower.includes("viral") || lower.includes("trend")) {
            setTimeout(() => this._showPhaseChips("scouted"), 1500);
        }
        // After any analysis, offer next steps
        else if (cadenceText.length > 60) {
            setTimeout(() => this._showPhaseChips("analyzed"), 1500);
        }
    }

    _showPhaseChips(phase) {
        const chipSets = {
            watching: [
                "Analyze my delivery style based on what you just heard",
                "What makes my hook effective?",
                "What patterns do you notice in my delivery?",
            ],
            analyzed: [
                "Search for viral trends that match my delivery style",
                "Write me a short script in my voice — coach me through it line by line",
                "What's the one thing I should improve?",
            ],
            scouted: [
                "Write me a script for that trend — walk me through it like a director",
                "How would I put my own spin on that trend?",
                "Search for more trending ideas like that",
            ],
        };
        if (chipSets[phase]) {
            this._showChips(chipSets[phase]);
        }
    }

    // --- Profile persistence ---

    _saveSessionProfile() {
        if (!this.userId) return;

        // Collect all Cadence analysis from this session
        const cadenceEntries = this.transcript.querySelectorAll(".transcript-entry.cadence .transcript-text");
        const observations = Array.from(cadenceEntries).map(el => el.textContent).filter(t => t.length > 20);

        if (observations.length === 0) return;

        // Load existing profile, merge observations, save
        fetch(`/api/profiles/${this.userId}`)
            .then(r => r.ok ? r.json() : { profile: {} })
            .then(data => {
                const profile = data.profile || {};
                const prev = profile.session_observations || [];
                profile.session_observations = prev.concat(observations).slice(-50); // Keep last 50
                profile.sessions_completed = (profile.sessions_completed || 0) + 1;
                profile.last_session = new Date().toISOString();

                return fetch(`/api/profiles/${this.userId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ profile }),
                });
            })
            .catch(() => {}); // Silent fail — don't block session stop
    }

    // --- Mode detection ---

    _detectMode(text) {
        const lower = text.toLowerCase();
        // Use multi-word phrases to avoid false triggers on common words
        if (lower.includes("trending") || lower.includes("viral") || lower.includes("what to make next") || lower.includes("scout")) {
            this._setMode("scout", "SCOUT");
        } else if (lower.includes("here's a script") || lower.includes("performance document") || lower.includes("draft for you") || lower.includes("delivery notes")) {
            this._setMode("create", "CREATE");
        }
        // Default stays STUDY — no need to actively detect it since that's the starting mode
    }

    _setMode(cssClass, label) {
        const pill = document.getElementById("mode-pill");
        if (!pill) return;
        pill.className = `mode-pill ${cssClass}`;
        pill.textContent = label;
    }

    // --- UI helpers ---

    setStatus(state, text) {
        this.statusDot.className = `status-dot ${state}`;
        this.statusText.textContent = text;
    }

    updateStatDisplay(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    updateDuration() {
        if (!this.stats.startTime) return;
        const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
        const m = Math.floor(elapsed / 60);
        const s = elapsed % 60;
        this.updateStatDisplay("stat-duration", `${m}:${s.toString().padStart(2, "0")}`);
    }

    pulseAvatar() {
        this.directorAvatar.classList.add("speaking");
    }

    stopAvatarPulse() {
        this.directorAvatar.classList.remove("speaking");
    }
}

// --- Init ---

document.addEventListener("DOMContentLoaded", () => {
    new Cadence();
});
