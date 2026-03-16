/**
 * AudioRecorder - Captures microphone input and streams PCM data.
 * Uses AudioWorklet for low-latency, off-main-thread processing.
 */
export class AudioRecorder {
    constructor(onAudioData) {
        this.onAudioData = onAudioData;
        this.audioContext = null;
        this.workletNode = null;
        this.stream = null;
        this.isRecording = false;
    }

    async start() {
        if (this.isRecording) return;

        // Capture mic at 16kHz mono
        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });

        this.audioContext = new AudioContext({ sampleRate: 16000 });
        await this.audioContext.audioWorklet.addModule("/static/js/pcm-recorder-processor.js");

        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.workletNode = new AudioWorkletNode(this.audioContext, "pcm-recorder-processor");

        this.workletNode.port.onmessage = (event) => {
            if (event.data.type === "audio") {
                // Convert Float32 to Int16 PCM
                const float32 = event.data.buffer;
                const int16 = new Int16Array(float32.length);
                for (let i = 0; i < float32.length; i++) {
                    const s = Math.max(-1, Math.min(1, float32[i]));
                    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                // Tag as mic audio (0x01 prefix) so server can distinguish streams
                const tagged = new Uint8Array(int16.byteLength + 1);
                tagged[0] = 0x01; // mic audio tag
                tagged.set(new Uint8Array(int16.buffer), 1);
                this.onAudioData(tagged.buffer);
            }
        };

        source.connect(this.workletNode);
        this.workletNode.connect(this.audioContext.destination);
        this.isRecording = true;
    }

    stop() {
        if (!this.isRecording) return;

        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
            this.stream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.isRecording = false;
    }
}
