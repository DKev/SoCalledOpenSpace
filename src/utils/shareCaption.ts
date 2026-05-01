import type { MeasurementResult } from './audioMeter';

/** Link appended to social posts (GitHub / project page). */
export const SHARE_PROJECT_URL = 'https://github.com/DKev/SoCalledOpenSpace';

/** Full caption for native share, WhatsApp, Telegram, copy — numbers filled in (English). */
export function buildShareCaption(m: MeasurementResult): string {
  const avg = Math.round(m.avgDb);
  const t = m.timestamp;
  const dateStr = t.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return [
    `I just used SoCalledOpenSpace to sample my desk noise: about ${avg} dB average over ${m.duration}s (display dB, not calibrated SPL — for fun / rough comparison only).`,
    `Because "open space" was never quiet.`,
    ``,
    `Badge image includes my snapshot, reading, and time. More info:`,
    SHARE_PROJECT_URL,
    ``,
    `Recorded ${dateStr} at ${timeStr}.`,
  ].join('\n');
}

/** Shorter line for Twitter / X (character limit). */
export function buildShareCaptionShort(m: MeasurementResult): string {
  const avg = Math.round(m.avgDb);
  return `Open office noise ~${avg} dB (${m.duration}s) · not calibrated SPL #SoCalledOpenSpace\n${SHARE_PROJECT_URL}`;
}
