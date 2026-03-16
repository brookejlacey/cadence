/**
 * AudioPlayer - Plays PCM audio received from the server.
 * Uses AudioWorklet with a ring buffer for smooth playback.
 */
export class AudioPlayer {
    constructor() {
        this.audioContext = null;
        this.workletNode = null;
        this.isInitialized = false;
        this.isPlaying = false;
        this._playbackTimeout = null;
        this._tailDelayMs = 300;
        this.onPlaybackEnd = null; // callback when playback goes idle
    }

    async initialize() {
        if (this.isInitialized) return;

        // Gemini outputs 24kHz PCM audio
        this.audioContext = new AudioContext({ sampleRate: 24000 });
        await this.audioContext.audioWorklet.addModule("/static/js/pcm-player-processor.js");

        this.workletNode = new AudioWorkletNode(this.audioContext, "pcm-player-processor");
        this.workletNode.connect(this.audioContext.destination);
        this.isInitialized = true;
    }

    /**
     * Enqueue raw PCM audio bytes (Int16, 24kHz) for playback.
     * Tracks playback state for echo gating.
     */
    playChunk(int16ArrayBuffer) {
        if (!this.isInitialized || !this.workletNode) return;

        // Mark as playing — used by mic gating to prevent echo
        this.isPlaying = true;
        clearTimeout(this._playbackTimeout);

        // Convert Int16 to Float32 for the worklet
        const int16 = new Int16Array(int16ArrayBuffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 0x8000;
        }

        this.workletNode.port.postMessage({
            type: "audio",
            buffer: float32,
        });

        // After each chunk, set a tail timeout — if no new chunk arrives
        // within the tail delay, assume playback stopped
        this._playbackTimeout = setTimeout(() => {
            this.isPlaying = false;
            if (this.onPlaybackEnd) this.onPlaybackEnd();
        }, this._tailDelayMs);
    }

    clear() {
        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: "clear" });
        }
        this.isPlaying = false;
        clearTimeout(this._playbackTimeout);
    }

    async resume() {
        if (this.audioContext && this.audioContext.state === "suspended") {
            await this.audioContext.resume();
        }
    }

    stop() {
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.isPlaying = false;
        clearTimeout(this._playbackTimeout);
        this.isInitialized = false;
    }
}
