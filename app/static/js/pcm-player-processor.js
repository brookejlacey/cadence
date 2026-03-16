/**
 * AudioWorklet processor for playing back PCM audio from the server.
 * Uses a ring buffer for smooth, glitch-free playback.
 */
class PCMPlayerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // 30-second ring buffer at 24kHz (720KB — more than enough for streaming)
        this._bufferSize = 24000 * 30;
        this._buffer = new Float32Array(this._bufferSize);
        this._writeIndex = 0;
        this._readIndex = 0;
        this._samplesAvailable = 0;

        this.port.onmessage = (event) => {
            if (event.data.type === "audio") {
                this._enqueue(event.data.buffer);
            } else if (event.data.type === "clear") {
                this._clear();
            }
        };
    }

    _enqueue(float32Data) {
        for (let i = 0; i < float32Data.length; i++) {
            this._buffer[this._writeIndex] = float32Data[i];
            this._writeIndex = (this._writeIndex + 1) % this._bufferSize;

            // If write catches up to read, advance read to avoid stale playback
            if (this._samplesAvailable >= this._bufferSize) {
                this._readIndex = (this._readIndex + 1) % this._bufferSize;
            } else {
                this._samplesAvailable++;
            }
        }
    }

    _clear() {
        this._writeIndex = 0;
        this._readIndex = 0;
        this._samplesAvailable = 0;
    }

    process(inputs, outputs) {
        const output = outputs[0];
        if (!output || !output.length) return true;

        const channel = output[0];

        for (let i = 0; i < channel.length; i++) {
            if (this._samplesAvailable > 0) {
                channel[i] = this._buffer[this._readIndex];
                this._readIndex = (this._readIndex + 1) % this._bufferSize;
                this._samplesAvailable--;
            } else {
                channel[i] = 0;
            }
        }

        return true;
    }
}

registerProcessor("pcm-player-processor", PCMPlayerProcessor);
