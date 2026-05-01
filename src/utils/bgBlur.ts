import type { FaceInfo } from './faceDetector';

/** Blur radius scaled to frame size — stronger so 720p+ reads clearly; capped for GPU cost each frame. */
export function blurRadiusForFrame(w: number, h: number): number {
  const s = Math.min(w, h);
  return Math.max(18, Math.min(68, Math.round(s / 11)));
}

/**
 * Portrait-style background blur: full frame blurred, face region redrawn sharp.
 * If `face` is null, draws an unmodified frame (no face to isolate).
 */
export function drawBgBlurComposite(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  w: number,
  h: number,
  face: FaceInfo | null,
  blurPx?: number
): void {
  const blur = blurPx ?? blurRadiusForFrame(w, h);
  ctx.clearRect(0, 0, w, h);

  if (!face) {
    ctx.drawImage(source, 0, 0, w, h);
    return;
  }

  ctx.save();
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(source, 0, 0, w, h);
  ctx.restore();

  const cx = face.bbox.x + face.bbox.w / 2;
  const cy = face.bbox.y + face.bbox.h / 2;
  // Tighter oval than the raw bbox so sides of head / background show more blur.
  const rx = Math.max(face.bbox.w * 0.62, w * 0.065);
  const ry = Math.max(face.bbox.h * 0.84, h * 0.085);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(source, 0, 0, w, h);
  ctx.restore();
}
