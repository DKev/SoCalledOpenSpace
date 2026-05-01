// Draw a rounded rectangle path (does not fill or stroke — caller decides).
export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Beauty / social filter ────────────────────────────────────────────────────
//
// Replicates the look of social-app camera filters (warm skin, smooth, glowing):
//   1. Surface blur  — edge-preserving smooth (approximates bilateral filter)
//   2. Colour grade  — warm tones, vibrance boost, gentle contrast lift
//   3. Soft glow     — screen-blended bloom for that "lit from within" look
//
// TODO: Replace pass 1 with a real WebGL bilateral or guided filter for faster,
//       higher-quality skin smoothing on high-res images.
export function beautyFilter(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  // ── Pass 1: surface blur ─────────────────────────────────────────────────
  // Blur on a scratch canvas, then blend back only where the per-pixel colour
  // distance is below a threshold (i.e. flat skin areas, not sharp edges).
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const sCtx = scratch.getContext('2d')!;
  sCtx.filter = 'blur(4px)';
  sCtx.drawImage(canvas, 0, 0);
  sCtx.filter = 'none';

  const orig = ctx.getImageData(0, 0, w, h);
  const blurred = sCtx.getImageData(0, 0, w, h);
  const px = orig.data;
  const bp = blurred.data;
  const surfaceThreshold = 60; // colour distance below which we smooth

  for (let i = 0; i < px.length; i += 4) {
    const dist = Math.abs(px[i] - bp[i]) + Math.abs(px[i+1] - bp[i+1]) + Math.abs(px[i+2] - bp[i+2]);
    if (dist < surfaceThreshold) {
      const t = 1 - dist / surfaceThreshold; // blend weight: 1 = full smooth
      px[i]   = px[i]   + (bp[i]   - px[i])   * t * 0.8 | 0;
      px[i+1] = px[i+1] + (bp[i+1] - px[i+1]) * t * 0.8 | 0;
      px[i+2] = px[i+2] + (bp[i+2] - px[i+2]) * t * 0.8 | 0;
    }
  }

  // ── Pass 2: colour grade ─────────────────────────────────────────────────
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i], g = px[i+1], b = px[i+2];

    // Warm shift: subtle red lift + blue pull
    r = Math.min(255, r * 1.06 + 6);
    g = Math.min(255, g * 1.02);
    b = Math.max(0,   b * 0.92);

    // Vibrance: boost less-saturated pixels more (protects already vivid colours)
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;
    const vib = (1 - saturation) * 0.3;
    r = r + (r - 128) * vib;
    g = g + (g - 128) * vib;
    b = b + (b - 128) * vib;

    // Slight brightness lift + contrast
    r = (r - 128) * 1.07 + 140;
    g = (g - 128) * 1.07 + 140;
    b = (b - 128) * 1.07 + 136; // blue lifted a touch less → warm feel

    px[i]   = Math.max(0, Math.min(255, r)) | 0;
    px[i+1] = Math.max(0, Math.min(255, g)) | 0;
    px[i+2] = Math.max(0, Math.min(255, b)) | 0;
  }

  ctx.putImageData(orig, 0, 0);

  // ── Pass 3: soft glow (screen blend) ────────────────────────────────────
  // Draw a heavily blurred copy of the processed image over itself in 'screen'
  // mode at low opacity → highlights bloom outward softly.
  const glow = document.createElement('canvas');
  glow.width = w;
  glow.height = h;
  const gCtx = glow.getContext('2d')!;
  gCtx.filter = 'blur(14px)';
  gCtx.drawImage(canvas, 0, 0);
  gCtx.filter = 'none';

  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.10;
  ctx.drawImage(glow, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// Draw an image centered and cropped to fill the target rect (CSS cover behaviour).
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const srcRatio = img.width / img.height;
  const dstRatio = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;

  if (srcRatio > dstRatio) {
    // Source is wider — crop sides
    sw = img.height * dstRatio;
    sx = (img.width - sw) / 2;
  } else {
    // Source is taller — crop top/bottom
    sh = img.width / dstRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** Load <img> for canvas draw + export. Remote URLs are fetched to a data URL when CORS allows (required for many logo CDNs). */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

/** Intrinsic size from SVG text (viewBox preferred). */
function parseSvgDimensions(svg: string): { w: number; h: number } | null {
  const vb =
    /viewBox\s*=\s*["']\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*["']/i.exec(
      svg
    );
  if (vb) {
    const w = parseFloat(vb[3]);
    const h = parseFloat(vb[4]);
    if (w > 0 && h > 0) return { w, h };
  }
  const widthM = /\bwidth\s*=\s*["']([^"']+)["']/i.exec(svg);
  const heightM = /\bheight\s*=\s*["']([^"']+)["']/i.exec(svg);
  if (widthM && heightM) {
    const w = parseFloat(widthM[1]);
    const h = parseFloat(heightM[1]);
    if (w > 0 && h > 0 && !widthM[1].includes('%') && !heightM[1].includes('%')) {
      return { w, h };
    }
  }
  return null;
}

/** Raster output: enough pixels for sharp badge corner; cap for memory. */
function scaleLogoRasterSize(w: number, h: number): { w: number; h: number } {
  const minSide = 256;
  const maxSide = 1024;
  let nw = Math.max(1, w);
  let nh = Math.max(1, h);
  const short = Math.min(nw, nh);
  if (short < minSide) {
    const s = minSide / short;
    nw = Math.round(nw * s);
    nh = Math.round(nh * s);
  }
  const long = Math.max(nw, nh);
  if (long > maxSide) {
    const s = maxSide / long;
    nw = Math.max(1, Math.round(nw * s));
    nh = Math.max(1, Math.round(nh * s));
  }
  return { w: nw, h: nh };
}

async function getBlobFromSrc(src: string): Promise<Blob | null> {
  try {
    if (src.startsWith('http://') || src.startsWith('https://')) {
      const res = await fetch(src, { mode: 'cors', credentials: 'omit' });
      return res.ok ? await res.blob() : null;
    }
    const res = await fetch(src);
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

/**
 * Many logo CDNs (Clearbit, favicons, etc.) omit CORS, so `fetch` fails even though `<img src>` works.
 * Try direct GET, then public image relays that return CORS-safe blobs for canvas export.
 */
async function getHttpLogoBlob(url: string): Promise<Blob | null> {
  let blob = await getBlobFromSrc(url);
  if (blob) return blob;

  const weserv = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=512&h=512&fit=inside&output=png`;
  try {
    const res = await fetch(weserv, { mode: 'cors', credentials: 'omit' });
    if (res.ok) {
      blob = await res.blob();
      if (blob.size > 0) return blob;
    }
  } catch {
    /* fall through */
  }

  const allorigins = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(allorigins, { mode: 'cors', credentials: 'omit' });
    if (res.ok) {
      blob = await res.blob();
      if (blob.size > 0) return blob;
    }
  } catch {
    /* fall through */
  }

  return null;
}

async function isLikelySvgBlob(blob: Blob): Promise<boolean> {
  const t = blob.type || '';
  if (/svg/i.test(t)) return true;
  const peek = new TextDecoder().decode(await blob.slice(0, 600).arrayBuffer());
  const s = peek.trimStart();
  return (/^<\?xml/i.test(s) && /<svg/i.test(peek)) || /^<svg/i.test(s);
}

/** Draw SVG to bitmap so canvas gets non-zero dimensions (fixes many CDN SVG logos). */
async function rasterizeSvgBlobToPngDataUrl(blob: Blob): Promise<string | null> {
  const text = await blob.text();
  const dim = parseSvgDimensions(text) ?? { w: 512, h: 512 };
  const { w, h } = scaleLogoRasterSize(dim.w, dim.h);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (!ctx) return null;

  const img = new Image();
  const url = URL.createObjectURL(
    new Blob([text], { type: 'image/svg+xml;charset=utf-8' })
  );
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('svg-decode'));
      img.src = url;
    });
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Pixels safe to draw on a badge canvas and call `toDataURL` (CORS / local only).
 * Returns a `data:` URL or `null` if the host blocks fetch (preview `<img>` may still work).
 */
export async function getCanvasSafeLogoDataUrl(src: string): Promise<string | null> {
  if (src.startsWith('data:')) return src;
  const blob =
    src.startsWith('http://') || src.startsWith('https://')
      ? await getHttpLogoBlob(src)
      : await getBlobFromSrc(src);
  if (!blob) return null;
  if (await isLikelySvgBlob(blob)) {
    return (await rasterizeSvgBlobToPngDataUrl(blob)) ?? null;
  }
  try {
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/**
 * Load an image safe for `canvas.drawImage` + `toDataURL` export.
 * Remote URLs are fetched (CORS). SVG is rasterized to PNG first so overlay always has pixel dimensions.
 */
export async function loadImageForCanvas(src: string): Promise<HTMLImageElement | null> {
  const dataUrl = await getCanvasSafeLogoDataUrl(src);
  if (!dataUrl) return null;
  return loadImageElement(dataUrl).catch(() => null);
}

/** Scale image to fit inside rect (letterboxing), centered. */
export function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}
