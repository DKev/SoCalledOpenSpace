import type { MeasurementResult } from './audioMeter';
import { drawImageCover, drawImageContain } from './imageUtils';

export type Orientation = 'portrait' | 'landscape';

export interface BadgeOptions {
  photo: HTMLImageElement | HTMLCanvasElement;
  measurement: MeasurementResult;
  logo: HTMLImageElement | null;
  orientation: Orientation;
}

/** SPL-style colour for average dB (exported + live preview). */
export function dbColor(db: number): string {
  if (db < 50) return '#4ade80';
  if (db < 65) return '#facc15';
  if (db < 75) return '#fb923c';
  return '#f87171';
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Stroke + fill — no background box; readable on variable photo. */
function strokedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fillStyle: string,
  strokeStyle = 'rgba(0,0,0,0.55)',
  lineWidth = 4
) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillStyle;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** One line, centered: `72 dB` — larger num + suffix, bottom of canvas. */
function drawDbLineCenterBottom(
  ctx: CanvasRenderingContext2D,
  avgDb: number,
  canvasW: number,
  canvasH: number,
  padBottom: number,
  numPx: number,
  unitPx: number
) {
  const n = Math.round(avgDb);
  const numStr = String(n);
  const y = canvasH - padBottom;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.font = `900 ${numPx}px system-ui, sans-serif`;
  const wNum = ctx.measureText(numStr).width;
  ctx.font = `600 ${unitPx}px system-ui, sans-serif`;
  const wSuf = ctx.measureText(' dB').width;
  let x = canvasW / 2 - (wNum + wSuf) / 2;

  ctx.font = `900 ${numPx}px system-ui, sans-serif`;
  strokedText(
    ctx,
    numStr,
    x,
    y,
    dbColor(n),
    'rgba(0,0,0,0.42)',
    Math.max(4, Math.round(numPx / 34))
  );

  x += wNum;
  ctx.font = `600 ${unitPx}px system-ui, sans-serif`;
  strokedText(ctx, ' dB', x, y, '#f4f4f8', 'rgba(0,0,0,0.5)', Math.max(2, Math.round(unitPx / 15)));
}

/** Time (bold) + date, top-right, no box. */
function drawDateTimeTopRight(
  ctx: CanvasRenderingContext2D,
  m: MeasurementResult,
  canvasW: number,
  pad: number,
  timeFont: string,
  dateFont: string,
  timeStroke: number,
  dateStroke: number
) {
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  const rx = canvasW - pad;
  let y = pad + 42;
  ctx.font = timeFont;
  strokedText(ctx, fmtTime(m.timestamp), rx, y, '#f4f4f8', 'rgba(0,0,0,0.45)', timeStroke);
  y += 58;
  ctx.font = dateFont;
  strokedText(
    ctx,
    fmtDate(m.timestamp),
    rx,
    y,
    'rgba(244,244,248,0.92)',
    'rgba(0,0,0,0.45)',
    dateStroke
  );
  ctx.restore();
}

/** Draw last so it stays on top; light plate + contain-fit for visibility on any photo. */
function drawLogoOnTop(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  pad: number,
  size: number,
  radius: number
) {
  if (!logo || logo.naturalWidth === 0 || logo.naturalHeight === 0) return;
  const x = pad;
  const y = pad;
  const plate = 4;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.beginPath();
  ctx.roundRect(x - plate, y - plate, size + plate * 2, size + plate * 2, radius + 3);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.clip();
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, size, size);
  drawImageContain(ctx, logo, x, y, size, size);
  ctx.restore();
}

// ── Portrait 9:16  900 × 1600 — full-bleed photo, text overlaid (no panel) ──
function renderPortrait(o: BadgeOptions): HTMLCanvasElement {
  const W = 900;
  const H = 1600;
  const PAD = 40;

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const m = o.measurement;

  drawImageCover(ctx, o.photo, 0, 0, W, H);

  drawDateTimeTopRight(
    ctx,
    m,
    W,
    PAD,
    `700 46px system-ui, sans-serif`,
    `400 46px system-ui, sans-serif`,
    4,
    5
  );

  drawDbLineCenterBottom(ctx, m.avgDb, W, H, 76, 218, 48);

  drawLogoOnTop(ctx, o.logo, PAD, 112, 14);

  return cv;
}

// ── Landscape 16:9  1600 × 900 — full-bleed photo, text overlaid ─────────────
function renderLandscape(o: BadgeOptions): HTMLCanvasElement {
  const W = 1600;
  const H = 900;
  const PAD = 48;

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const m = o.measurement;

  drawImageCover(ctx, o.photo, 0, 0, W, H);

  drawDateTimeTopRight(
    ctx,
    m,
    W,
    PAD,
    `700 40px system-ui, sans-serif`,
    `400 42px system-ui, sans-serif`,
    4,
    5
  );

  drawDbLineCenterBottom(ctx, m.avgDb, W, H, 58, 168, 40);

  drawLogoOnTop(ctx, o.logo, PAD, 104, 12);

  return cv;
}

export function renderBadge(options: BadgeOptions): HTMLCanvasElement {
  return options.orientation === 'portrait'
    ? renderPortrait(options)
    : renderLandscape(options);
}
