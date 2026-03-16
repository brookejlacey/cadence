/**
 * AudioWorklet processor for capturing microphone input as PCM data.
 * Runs in the audio rendering thread for low-latency capture.
 */
class PCMRecorderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._bufferSize = 2048;
        this._buffer = new Float32Array(this._bufferSize);
        this._bytesWritten = 0;
    }

    /**
     * Process audio input frames.
     * Accumulates samples and sends chunks to the main thread.
     */
    process(inputs) {
        const input = inputs[0];
        if (!input || !input.length) return true;

        const channelData = input[0];

        for (let i = 0; i < channelData.length; i++) {
            this._buffer[this._bytesWritten++] = channelData[i];

            if (this._bytesWritten >= this._bufferSize) {
                this.port.postMessage({
                    type: "audio",
                    buffer: this._buffer.slice(),
                });
                this._bytesWritten = 0;
            }
        }

        return true;
    }
}

registerProcessor("pcm-recorder-processor", PCMRecorderProcessor);
