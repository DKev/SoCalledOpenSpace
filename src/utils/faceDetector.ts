import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

// MediaPipe blaze-face short-range — fast, runs in-browser via WASM.
// WASM and model are loaded from CDN on first use (requires internet).
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

let detector: FaceDetector | null = null;
let initPromise: Promise<void> | null = null;

export async function initFaceDetector(): Promise<void> {
  if (detector) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_PATH },
      runningMode: 'IMAGE', // we snapshot the video each frame
      minDetectionConfidence: 0.5,
    });
  })();
  return initPromise;
}

export interface FaceInfo {
  // pixel coordinates in the source image
  leftEye:  { x: number; y: number };
  rightEye: { x: number; y: number };
  nose:     { x: number; y: number };
  bbox:     { x: number; y: number; w: number; h: number };
}

/** Run synchronous face detection on a canvas snapshot. Returns null if no face found. */
export function detectFace(canvas: HTMLCanvasElement): FaceInfo | null {
  if (!detector) return null;
  try {
    const result = detector.detect(canvas);
    if (!result.detections.length) return null;

    const det = result.detections[0];
    const kp  = det.keypoints;   // NormalizedKeypoint[], values in [0, 1]
    const bb  = det.boundingBox!; // pixels

    const W = canvas.width;
    const H = canvas.height;

    return {
      // MediaPipe keypoint order: 0=right eye, 1=left eye, 2=nose tip ...
      // (from the model's perspective the right eye is on the LEFT side of the image)
      rightEye: { x: kp[0].x * W, y: kp[0].y * H },
      leftEye:  { x: kp[1].x * W, y: kp[1].y * H },
      nose:     { x: kp[2].x * W, y: kp[2].y * H },
      bbox:     { x: bb.originX, y: bb.originY, w: bb.width, h: bb.height },
    };
  } catch {
    return null;
  }
}
