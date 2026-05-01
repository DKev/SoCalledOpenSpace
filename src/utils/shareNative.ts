/**
 * System share sheet (mobile): image file + pre-written caption when supported.
 */
export async function shareBadgeAsFile(
  dataUrl: string,
  caption: string
): Promise<'ok' | 'unsupported' | 'cancelled' | 'error'> {
  if (!navigator.share) return 'unsupported';

  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `SoCalledOpenSpace-${Date.now()}.png`, {
      type: 'image/png',
    });

    const withFiles: ShareData = {
      title: 'SoCalledOpenSpace',
      text: caption,
      files: [file],
    };

    if (typeof navigator.canShare === 'function' && !navigator.canShare(withFiles)) {
      await navigator.share({ title: 'SoCalledOpenSpace', text: caption });
      return 'ok';
    }

    await navigator.share(withFiles);
    return 'ok';
  } catch (e: unknown) {
    if (
      e instanceof DOMException &&
      e.name === 'AbortError'
    ) {
      return 'cancelled';
    }
    if (e && typeof e === 'object' && 'name' in e && (e as { name: string }).name === 'AbortError') {
      return 'cancelled';
    }
    return 'error';
  }
}

export function openWhatsAppWithText(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

export function openTwitterWithText(text: string): void {
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    '_blank',
    'noopener,noreferrer'
  );
}

/** Facebook web sharer: prefilled quote + link (image must be added in app after download / from share sheet). */
export function openFacebookShare(quote: string, url: string): void {
  const u = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(quote)}`;
  window.open(u, '_blank', 'noopener,noreferrer');
}

export function openTelegramShare(text: string, url: string): void {
  window.open(
    `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    '_blank',
    'noopener,noreferrer'
  );
}
