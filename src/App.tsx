import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioMeter, MeasurementResult } from './utils/audioMeter';
import { renderBadge, type Orientation, dbColor } from './utils/badgeRenderer';
import { LogoPicker } from './components/LogoPicker';
import {
  IconDownload,
  IconShare,
  IconWhatsApp,
  IconFacebook,
  IconX,
  IconTelegram,
} from './components/ShareActionIcons';
import { initFaceDetector, detectFace, type FaceInfo } from './utils/faceDetector';
import { drawBgBlurComposite, blurRadiusForFrame } from './utils/bgBlur';
import {
  buildShareCaption,
  buildShareCaptionShort,
  SHARE_PROJECT_URL,
} from './utils/shareCaption';
import {
  shareBadgeAsFile,
  openWhatsAppWithText,
  openTwitterWithText,
  openFacebookShare,
  openTelegramShare,
} from './utils/shareNative';
import { drawSticker, FILTERS, type FilterType } from './utils/stickerRenderer';
import { loadImageForCanvas, getCanvasSafeLogoDataUrl } from './utils/imageUtils';

type Phase = 'idle' | 'running' | 'done' | 'error';

const DURATION = 15;

function formatBadgeTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
function formatBadgeDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function App() {
  const [phase, setPhase]           = useState<Phase>('idle');
  const [liveDb, setLiveDb]         = useState(0);
  const [remaining, setRemaining]   = useState(DURATION);
  const [badgeDataUrl, setBadge]    = useState<string | null>(null);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [logoDataUrl, setLogo]      = useState<string | null>(null);
  const [logoRemoteBlocked, setLogoRemoteBlocked] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 600px)').matches
      ? 'portrait'
      : 'landscape'
  );
  const [selectedFilter, setFilter] = useState<FilterType>('none');
  const [blurBackground, setBlurBackground] = useState(false);
  const [detectorReady, setDetectorReady] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [liveClock, setLiveClock] = useState(() => new Date());

  const videoRef            = useRef<HTMLVideoElement | null>(null);
  const processedVideoRef   = useRef<HTMLCanvasElement | null>(null);
  const overlayRef          = useRef<HTMLCanvasElement | null>(null);
  const camStreamRef        = useRef<MediaStream | null>(null);
  const meterRef            = useRef<AudioMeter | null>(null);
  const resultRef           = useRef<MeasurementResult | null>(null);
  const filterRef           = useRef<FilterType>('none');
  const blurBgRef           = useRef(false);
  const lastFaceRef         = useRef<FaceInfo | null>(null);
  const rafRef              = useRef<number>(0);

  useEffect(() => {
    if (!logoDataUrl) {
      setLogoRemoteBlocked(false);
      return;
    }
    if (logoDataUrl.startsWith('data:') || logoDataUrl.startsWith('blob:')) {
      setLogoRemoteBlocked(false);
      return;
    }
    let cancelled = false;
    setLogoRemoteBlocked(false);
    getCanvasSafeLogoDataUrl(logoDataUrl).then((safe) => {
      if (!cancelled) setLogoRemoteBlocked(!safe);
    });
    return () => {
      cancelled = true;
    };
  }, [logoDataUrl]);

  // Keep refs in sync so async callbacks read current values.
  useEffect(() => { filterRef.current = selectedFilter; }, [selectedFilter]);
  useEffect(() => { blurBgRef.current = blurBackground; }, [blurBackground]);

  // Start loading face detector in the background immediately.
  useEffect(() => {
    initFaceDetector().then(() => setDetectorReady(true)).catch(() => {});
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;
    setLiveClock(new Date());
    const id = window.setInterval(() => setLiveClock(new Date()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Attach camera stream to <video> after it mounts.
  useEffect(() => {
    if (phase === 'running' && videoRef.current && camStreamRef.current) {
      videoRef.current.srcObject = camStreamRef.current;
    }
  }, [phase]);

  // Live sticker overlay loop — runs every animation frame while measuring.
  useEffect(() => {
    if (phase !== 'running') {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastDetect = 0;

    function loop(ts: number) {
      const video     = videoRef.current;
      const processed = processedVideoRef.current;
      const overlay   = overlayRef.current;
      if (!video || !overlay || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Match overlay size to actual displayed video dimensions.
      if (overlay.width !== video.videoWidth) {
        overlay.width  = video.videoWidth;
        overlay.height = video.videoHeight;
      }
      if (blurBgRef.current && processed) {
        if (processed.width !== video.videoWidth) {
          processed.width  = video.videoWidth;
          processed.height = video.videoHeight;
        }
      }

      const filter = filterRef.current;
      const wantBlur = blurBgRef.current;
      const needFace = (filter !== 'none' || wantBlur) && detectorReady;

      if (needFace && ts - lastDetect > 80) {
        lastDetect = ts;
        const snap = document.createElement('canvas');
        snap.width = video.videoWidth;
        snap.height = video.videoHeight;
        snap.getContext('2d')!.drawImage(video, 0, 0);
        lastFaceRef.current = detectFace(snap);
      }

      if (wantBlur && processed) {
        const pctx = processed.getContext('2d')!;
        drawBgBlurComposite(
          pctx,
          video,
          video.videoWidth,
          video.videoHeight,
          lastFaceRef.current,
          blurRadiusForFrame(video.videoWidth, video.videoHeight)
        );
      }

      const ctx = overlay.getContext('2d')!;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      if (filter !== 'none' && lastFaceRef.current) {
        drawSticker(ctx, filter, lastFaceRef.current);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, detectorReady]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      meterRef.current?.stop();
      camStreamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Capture last video frame (+ stickers) then compose badge ───────────────
  const captureAndBadge = useCallback(async (result: MeasurementResult) => {
    // Next paint (+1 frame): timer callbacks can hit between video/canvas updates (esp. blur path + Safari).
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    for (let i = 0; i < 30; i++) {
      const v = videoRef.current;
      if (v && v.videoWidth > 0) break;
      await new Promise(r => setTimeout(r, 50));
    }

    const video = videoRef.current;
    const processed = processedVideoRef.current;
    let capture: HTMLCanvasElement | null = null;

    try {
      if (video && video.videoWidth > 0) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d')!;
        const filter = filterRef.current;
        const doBlur = blurBgRef.current;

        let face: FaceInfo | null = null;
        if (detectorReady && (filter !== 'none' || doBlur)) {
          const snap = document.createElement('canvas');
          snap.width = w;
          snap.height = h;
          snap.getContext('2d')!.drawImage(video, 0, 0);
          face = detectFace(snap);
        }

        if (doBlur && processed && processed.width === w && processed.height === h) {
          ctx.drawImage(processed, 0, 0);
        } else if (doBlur) {
          drawBgBlurComposite(ctx, video, w, h, face, blurRadiusForFrame(w, h));
        } else {
          ctx.drawImage(video, 0, 0);
        }

        if (filter !== 'none' && detectorReady && face) {
          drawSticker(ctx, filter, face);
        }
        capture = c;
      }
    } finally {
      camStreamRef.current?.getTracks().forEach(t => t.stop());
      camStreamRef.current = null;
    }

    if (!capture) {
      setPhase('error');
      setErrorMsg('No photo from camera. Check camera permission and try again.');
      return;
    }

    try {
      const logo = logoDataUrl ? await loadImageForCanvas(logoDataUrl) : null;

      const tryExport = (withLogo: HTMLImageElement | null) =>
        renderBadge({
          photo: capture!,
          measurement: result,
          logo: withLogo,
          orientation,
        });

      let canvas = tryExport(logo);
      let png: string;
      try {
        png = canvas.toDataURL('image/png');
      } catch {
        if (logo) {
          canvas = tryExport(null);
          png = canvas.toDataURL('image/png');
        } else {
          throw new Error('PNG export failed');
        }
      }
      setBadge(png);
      setPhase('done');
    } catch (err) {
      console.error('Could not build badge:', err);
      setPhase('error');
      setErrorMsg('Could not build the badge. Try again.');
    }
  }, [detectorReady, logoDataUrl, orientation]);

  // ── Start ──────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    setErrorMsg(null);
    setBadge(null);
    setShareNotice(null);
    setLiveDb(0);
    setRemaining(DURATION);
    lastFaceRef.current = null;

    let camStream: MediaStream | null = null;
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    } catch {
      setPhase('error');
      setErrorMsg('Could not access the camera. Allow camera permission and try again.');
      return;
    }

    camStreamRef.current = camStream;
    setPhase('running');

    const meter = new AudioMeter();
    meterRef.current = meter;
    try {
      await meter.start(DURATION,
        db  => setLiveDb(Math.round(db)),
        rem => setRemaining(Math.ceil(rem)),
        res => { resultRef.current = res; captureAndBadge(res); }
      );
    } catch {
      setPhase('error');
      setErrorMsg('Microphone access denied. Please allow microphone permissions and try again.');
      camStream?.getTracks().forEach(t => t.stop());
    }
  }, [captureAndBadge]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    meterRef.current?.stop();
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    camStreamRef.current = null;
    resultRef.current = null;
    setPhase('idle');
    setLiveDb(0);
    setRemaining(DURATION);
    setBadge(null);
    setErrorMsg(null);
    setShareNotice(null);
    lastFaceRef.current = null;
  }, []);

  const download = useCallback(() => {
    if (!badgeDataUrl) return;
    const a = document.createElement('a');
    a.href = badgeDataUrl;
    a.download = `so-called-open-space-${Date.now()}.png`;
    a.click();
  }, [badgeDataUrl]);

  const showShareNotice = useCallback((msg: string) => {
    setShareNotice(msg);
    window.setTimeout(() => setShareNotice(null), 4000);
  }, []);

  const nativeShare = useCallback(async () => {
    if (!badgeDataUrl) return;
    const r = resultRef.current;
    if (!r) return;
    const cap = buildShareCaption(r);
    const status = await shareBadgeAsFile(badgeDataUrl, cap);
    if (status === 'unsupported') {
      showShareNotice('Sharing is not supported here. Use Save image or the buttons below.');
    } else if (status === 'error') {
      showShareNotice('Share did not complete. Try Save image.');
    }
  }, [badgeDataUrl, showShareNotice]);

  const progressPct = ((DURATION - remaining) / DURATION) * 100;
  const result = resultRef.current;

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">SoCalledOpenSpace</h1>
        <p className="app-tagline">Because "open space" was never quiet.</p>
      </header>

      <main className="app-main">

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <div className="center-panel">
            <p className="intro-text">
              Press start — optional emoji over your face, then noise is measured for {DURATION}s.
            </p>

            {/* Emoji overlay picker */}
            <div className="filter-picker filter-picker--emoji">
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  className={`filter-btn${selectedFilter === f.id ? ' active' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {!detectorReady && (selectedFilter !== 'none' || blurBackground) && (
              <p className="hint-sm">Loading face detection…</p>
            )}

            <div className="aspect-picker-row">
              <span className="aspect-label">Background</span>
              <div className="filter-picker">
                <button
                  type="button"
                  className={`filter-btn${!blurBackground ? ' active' : ''}`}
                  onClick={() => setBlurBackground(false)}
                >
                  Normal
                </button>
                <button
                  type="button"
                  className={`filter-btn${blurBackground ? ' active' : ''}`}
                  onClick={() => setBlurBackground(true)}
                >
                  Blur · sharp face
                </button>
              </div>
            </div>

            <div className="aspect-picker-row">
              <span className="aspect-label">Export aspect ratio</span>
              <div className="filter-picker">
                <button
                  type="button"
                  className={`filter-btn${orientation === 'landscape' ? ' active' : ''}`}
                  onClick={() => setOrientation('landscape')}
                >
                  16∶9 landscape
                </button>
                <button
                  type="button"
                  className={`filter-btn${orientation === 'portrait' ? ' active' : ''}`}
                  onClick={() => setOrientation('portrait')}
                >
                  9∶16 portrait
                </button>
              </div>
              <p className="hint-sm aspect-hint">PNG: 1600×900 or 900×1600 — your snapshot, dB, time, optional logo.</p>
            </div>

            <LogoPicker value={logoDataUrl} onChange={setLogo} />
            {logoRemoteBlocked && (
              <p className="hint-sm logo-export-hint">
                This host allows the preview thumbnail but blocks reading pixels for the PNG. Use <strong>Upload</strong>{' '}
                in the logo picker so the badge export includes your logo.
              </p>
            )}

            <button className="btn-start" onClick={start}>Start</button>
            <p className="privacy-note">Everything stays in your browser. Nothing is uploaded to us.</p>
            <p className="disclaimer-inline">
              By using this site you accept the{' '}
              <a href="#disclaimer">disclaimer</a>.
            </p>
          </div>
        )}

        {/* ── RUNNING ── */}
        {phase === 'running' && (
          <div className="running-panel">
            <div className="running-toolbar">
              <button type="button" className="btn-running-back" onClick={reset} aria-label="Stop and go back">
                ← Back
              </button>
            </div>
            <div className={`video-wrap video-wrap--${orientation}`}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={blurBackground ? 'live-video live-video--source-only' : 'live-video'}
              />
              {blurBackground && (
                <canvas ref={processedVideoRef} className="video-processed" aria-hidden />
              )}
              {/* Emoji overlay — drawn on top of video / processed frame */}
              <canvas ref={overlayRef} className="filter-overlay" />
              {logoDataUrl && (
                <div className="video-badge-logo-wrap" aria-hidden>
                  <div className="video-badge-logo-plate">
                    <img src={logoDataUrl} alt="" className="video-badge-logo-img" />
                  </div>
                </div>
              )}
              <div className="video-overlay-time" aria-hidden>
                <div className="video-overlay-time-line">{formatBadgeTime(liveClock)}</div>
                <div className="video-overlay-date-line">{formatBadgeDate(liveClock)}</div>
              </div>
              <div className="video-overlay-db-row">
                <span className="db-live-num" style={{ color: dbColor(liveDb) }}>
                  {liveDb}
                </span>
                <span className="db-live-unit"> dB</span>
              </div>
            </div>
            <div className="progress-wrap">
              <div className="progress-bar" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="countdown-text">Measuring… {remaining}s left</p>
          </div>
        )}

        {/* ── DONE ── */}
        {phase === 'done' && badgeDataUrl && result && (
          <div className="done-panel">
            <div
              className={`badge-preview-wrap badge-preview-wrap--${orientation}`}
              role="img"
              aria-label="Noise badge preview"
            >
              <img src={badgeDataUrl} alt="" className="badge-preview-img" />
            </div>
            <div className="done-stats">
              <span>Avg <strong>{Math.round(result.avgDb)} dB</strong></span>
            </div>

            {shareNotice && (
              <p className="share-notice" role="status">
                {shareNotice}
              </p>
            )}

            <div className="share-toolbar">
              <button type="button" className="share-chip share-chip--primary" onClick={download} aria-label="Download image">
                <IconDownload />
              </button>
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                <button type="button" className="share-chip share-chip--primary" onClick={nativeShare} aria-label="Share">
                  <IconShare />
                </button>
              )}
              <button
                type="button"
                className="share-chip"
                aria-label="WhatsApp"
                onClick={() => openWhatsAppWithText(buildShareCaption(result))}
              >
                <IconWhatsApp />
              </button>
              <button
                type="button"
                className="share-chip"
                aria-label="Facebook"
                onClick={() =>
                  openFacebookShare(
                    `SoCalledOpenSpace: open-plan desk noise about ${Math.round(result.avgDb)} dB avg (display, not SPL). Because "open space" was never quiet.`,
                    SHARE_PROJECT_URL
                  )
                }
              >
                <IconFacebook />
              </button>
              <button
                type="button"
                className="share-chip"
                aria-label="X"
                onClick={() => openTwitterWithText(buildShareCaptionShort(result))}
              >
                <IconX />
              </button>
              <button
                type="button"
                className="share-chip"
                aria-label="Telegram"
                onClick={() => openTelegramShare(buildShareCaption(result), SHARE_PROJECT_URL)}
              >
                <IconTelegram />
              </button>
            </div>

            <div className="done-actions">
              <button type="button" className="btn-again" onClick={reset}>
                Measure Again
              </button>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {phase === 'error' && (
          <div className="center-panel">
            <p className="error-text">{errorMsg}</p>
            <button className="btn-again" onClick={reset}>Try Again</button>
          </div>
        )}

      </main>

      <footer className="app-footer">
        <details className="footer-disclaimer" id="disclaimer">
          <summary className="footer-disclaimer-summary">Disclaimer</summary>
          <div className="footer-disclaimer-body">
            <p>
              <strong>Not a professional instrument.</strong> Decibel (dB) values shown are computed from your
              device microphone and are <strong>not</strong> calibrated sound pressure level (SPL). They vary by
              hardware and environment and are intended only for informal comparison or entertainment, not for
              occupational safety, noise complaints, legal disputes, or compliance.
            </p>
            <p>
              <strong>No warranty.</strong> SoCalledOpenSpace is provided &ldquo;as is&rdquo; without warranty of
              any kind. We are not liable for any damages or decisions based on this app, including shared images
              or captions.
            </p>
            <p>
              <strong>Privacy &amp; third parties.</strong> Audio and the camera snapshot are processed in your
              browser; we do not receive them on our servers. Face emoji overlay loads MediaPipe from a CDN on
              first use. Company logos from the grid may be retrieved via direct fetch or, when the host blocks
              that, a public image relay (images.weserv.nl / allorigins) so the PNG export can include them — those
              services see the icon URL. Uploading a logo file stays fully local. See the README for details.
            </p>
            <p>
              <strong>Use at your own risk.</strong> Do not use this app while driving or in unsafe situations.
              By using the site you agree to these terms.
            </p>
          </div>
        </details>
        <p className="app-footer-meta">SoCalledOpenSpace · MIT · Built in your browser</p>
      </footer>
    </div>
  );
}
