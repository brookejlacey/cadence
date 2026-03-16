/**
 * AudioWorklet processor for capturing tab/screen audio as PCM data.
 * Replaces deprecated ScriptProcessorNode for tab audio capture.
 * Runs in the audio rendering thread for low-latency, off-main-thread processing.
 */
class PCMTabProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._bufferSize = 2048;
        this._buffer = new Float32Array(this._bufferSize);
        this._bytesWritten = 0;
    }

    process(inputs) {
        const input = inputs[0];
        if (!input || !input.length) return true;

        const channelData = input[0];

        for (let i = 0; i < channelData.length; i++) {
            this._buffer[this._bytesWritten++] = channelData[i];

            if (this._bytesWritten >= this._bufferSize) {
                // Convert Float32 to Int16 PCM
                const int16 = new Int16Array(this._bufferSize);
                for (let j = 0; j < this._bufferSize; j++) {
                    const s = Math.max(-1, Math.min(1, this._buffer[j]));
                    int16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                this.port.postMessage({
                    type: "audio",
                    buffer: int16.buffer,
                }, [int16.buffer]);
                this._bytesWritten = 0;
            }
        }

        return true;
    }
}

registerProcessor("pcm-tab-processor", PCMTabProcessor);
