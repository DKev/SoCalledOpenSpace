import type { FaceInfo } from './faceDetector';

export type FilterType =
  | 'none'
  | 'e_joy'
  | 'e_rofl'
  | 'e_cool'
  | 'e_disguise'
  | 'e_clown'
  | 'e_melt'
  | 'e_mask';

/** Emoji shown in picker = what gets drawn over the face. */
export const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'none', label: 'Off' },
  { id: 'e_joy', label: '😂' },
  { id: 'e_rofl', label: '🤣' },
  { id: 'e_cool', label: '😎' },
  { id: 'e_disguise', label: '🥸' },
  { id: 'e_clown', label: '🤡' },
  { id: 'e_melt', label: '🫠' },
  { id: 'e_mask', label: '😷' },
];

const EMOJI: Partial<Record<FilterType, string>> = {
  e_joy: '😂',
  e_rofl: '🤣',
  e_cool: '😎',
  e_disguise: '🥸',
  e_clown: '🤡',
  e_melt: '🫠',
  e_mask: '😷',
};

const EMOJI_FONT =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';

/** Visible ink span for one emoji at fontPx (em-square padding varies by font). */
function emojiInkSpan(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  fontPx: number
): number {
  ctx.font = `${fontPx}px ${EMOJI_FONT}`;
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(emoji);
  let w = m.width;
  if (m.actualBoundingBoxLeft != null && m.actualBoundingBoxRight != null) {
    w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  }
  let h = fontPx * 0.82;
  if (m.actualBoundingBoxAscent != null && m.actualBoundingBoxDescent != null) {
    h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  }
  return Math.max(w, h);
}

/**
 * Scale emoji so its drawn ink matches the face box: Blaze Face bbox is tight,
 * emoji fonts leave margin inside the font size — we binary-search fontPx instead of guessing.
 */
function drawEmojiCover(ctx: CanvasRenderingContext2D, face: FaceInfo, emoji: string): void {
  const { bbox, leftEye, rightEye } = face;
  const cx = bbox.x + bbox.w / 2;
  const bboxAnchorY = bbox.y + bbox.h * 0.47;
  const eyeY = (leftEye.y + rightEye.y) / 2;
  // Nudge vertical center toward the eyes vs. box midpoint.
  const cy = bboxAnchorY * 0.38 + eyeY * 0.62;

  const faceSpan = Math.max(bbox.w, bbox.h);
  const diag = Math.hypot(bbox.w, bbox.h);
  const target = Math.max(faceSpan * 1.72, diag * 1.26);

  let lo = 10;
  let hi = Math.min(Math.max(ctx.canvas.width, ctx.canvas.height), faceSpan * 4.4);

  ctx.save();
  ctx.textAlign = 'center';

  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) * 0.5;
    if (emojiInkSpan(ctx, emoji, mid) < target) lo = mid;
    else hi = mid;
  }

  const fontPx = Math.max(12, (lo + hi) * 0.5);
  ctx.font = `${fontPx}px ${EMOJI_FONT}`;
  ctx.textBaseline = 'alphabetic';

  const m = ctx.measureText(emoji);
  const ascent = m.actualBoundingBoxAscent ?? fontPx * 0.72;
  const descent = m.actualBoundingBoxDescent ?? fontPx * 0.28;
  // Alphabetic baseline so ink vertical center lands on `cy`
  const drawY = cy - (descent - ascent) * 0.5;

  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.5, fontPx * 0.045);
  ctx.strokeStyle = 'rgba(0,0,0,0.36)';
  ctx.strokeText(emoji, cx, drawY);
  ctx.fillText(emoji, cx, drawY);
  ctx.restore();
}

export function drawSticker(
  ctx: CanvasRenderingContext2D,
  filter: FilterType,
  face: FaceInfo
): void {
  if (filter === 'none') return;
  const emoji = EMOJI[filter];
  if (!emoji) return;
  drawEmojiCover(ctx, face, emoji);
}
