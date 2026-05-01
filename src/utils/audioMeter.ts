export interface MeasurementResult {
  avgDb: number;
  maxDb: number;
  duration: number;
  timestamp: Date;
}

export type SampleCallback = (db: number) => void;
export type TickCallback = (remaining: number) => void;
export type CompleteCallback = (result: MeasurementResult) => void;

// Convert RMS amplitude to an approximate display dB value.
// The raw Web Audio values are in the range [-1, 1], so the raw dB will be
// negative (0 = full scale). We shift by +100 to map near-silence to ~0
// and typical speech/office noise to a recognisable 40–80 dB display range.
// NOTE: this is NOT calibrated SPL — it is a relative approximation.
function rmsToDisplayDb(rms: number): number {
  if (rms <= 0) return 0;
  const raw = 20 * Math.log10(rms); // typically -∞ … 0
  const display = Math.max(0, raw + 100); // shift so silence ≈ 0
  return Math.min(120, display);
}

/** Which full second (0 … duration-1) sample index `i` belongs to — `sampleMs` spacing from first tick. */
function secondIndexForSample(i: number, sampleMs: number, durationSeconds: number): number {
  const tMs = (i + 1) * sampleMs;
  const s = Math.floor((tMs - 1) / 1000);
  return Math.max(0, Math.min(s, durationSeconds - 1));
}

/**
 * Mean dB after dropping the 1s window with the *highest* bucket mean and the 1s window
 * with the *lowest* bucket mean (typical office “trim spikes / dead air”).
 * If that would leave nothing or there are fewer than 3 seconds of buckets, returns plain mean.
 */
export function trimmedMeanDb(
  samples: number[],
  durationSeconds: number,
  sampleMs: number
): number {
  if (samples.length === 0) return 0;

  const bucketSum: number[] = Array(durationSeconds).fill(0);
  const bucketCount: number[] = Array(durationSeconds).fill(0);

  for (let i = 0; i < samples.length; i++) {
    const s = secondIndexForSample(i, sampleMs, durationSeconds);
    bucketSum[s] += samples[i];
    bucketCount[s] += 1;
  }

  const activeSecs: number[] = [];
  for (let s = 0; s < durationSeconds; s++) {
    if (bucketCount[s] > 0) activeSecs.push(s);
  }

  if (activeSecs.length < 3) {
    return samples.reduce((a, b) => a + b, 0) / samples.length;
  }

  const means = activeSecs.map((s) => ({
    s,
    mean: bucketSum[s] / bucketCount[s],
  }));

  let iHi = 0;
  let iLo = 0;
  for (let k = 1; k < means.length; k++) {
    if (means[k].mean > means[iHi].mean) iHi = k;
    if (means[k].mean < means[iLo].mean) iLo = k;
  }

  const exclude = new Set<number>();
  exclude.add(means[iHi].s);
  if (means[iLo].s !== means[iHi].s) exclude.add(means[iLo].s);

  let sum = 0;
  let n = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = secondIndexForSample(i, sampleMs, durationSeconds);
    if (!exclude.has(s)) {
      sum += samples[i];
      n += 1;
    }
  }

  if (n === 0) {
    return samples.reduce((a, b) => a + b, 0) / samples.length;
  }
  return sum / n;
}

export class AudioMeter {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  // NOTE: getUserMedia requires a secure context (HTTPS or localhost).
  async start(
    durationSeconds: number,
    onSample: SampleCallback,
    onTick: TickCallback,
    onComplete: CompleteCallback
  ): Promise<void> {
    if (this.running) return;

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.audioContext = new AudioContext();

    const source = this.audioContext.createMediaStreamSource(this.stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    const samples: number[] = [];
    const startTime = Date.now();
    const sampleMs = 100; // 10 samples per second
    let elapsed = 0;
    this.running = true;

    this.intervalId = setInterval(() => {
      if (!this.running) return;

      analyser.getFloatTimeDomainData(buffer);

      let sumSq = 0;
      for (let i = 0; i < buffer.length; i++) {
        sumSq += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sumSq / buffer.length);
      const db = rmsToDisplayDb(rms);

      samples.push(db);
      onSample(db);

      elapsed += sampleMs;
      onTick(Math.max(0, durationSeconds - elapsed / 1000));

      if (elapsed >= durationSeconds * 1000) {
        this.stop();
        const avg = trimmedMeanDb(samples, durationSeconds, sampleMs);
        const max = Math.max(...samples);
        onComplete({
          avgDb: Math.round(avg * 10) / 10,
          maxDb: Math.round(max * 10) / 10,
          duration: durationSeconds,
          timestamp: new Date(startTime),
        });
      }
    }, sampleMs);
  }

  stop(): void {
    this.running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
