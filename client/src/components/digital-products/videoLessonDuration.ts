const YOUTUBE_HOST = /youtube\.com|youtu\.be/i;

const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i;

function isVimeoHostname(hostname: string): boolean {
  return hostname === "vimeo.com" || hostname.endsWith(".vimeo.com");
}

export function isYoutubeUrl(url: string): boolean {
  try {
    return YOUTUBE_HOST.test(new URL(url.trim()).hostname);
  } catch {
    return false;
  }
}

export function isVimeoUrl(url: string): boolean {
  try {
    return isVimeoHostname(new URL(url.trim()).hostname);
  } catch {
    return false;
  }
}

export function isDirectVideoUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return VIDEO_EXT.test(u.pathname.toLowerCase());
  } catch {
    return false;
  }
}

export async function fetchVimeoDurationSeconds(url: string): Promise<number | null> {
  const oembed = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url.trim())}`;
  const res = await fetch(oembed);
  if (!res.ok) return null;
  const data = (await res.json()) as { duration?: unknown };
  const d = data.duration;
  if (typeof d === "number" && Number.isFinite(d) && d > 0) return d;
  return null;
}

export function fetchDirectVideoDurationSeconds(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    let settled = false;
    const finish = (val: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      v.removeAttribute("src");
      v.load();
      v.remove();
      resolve(val);
    };
    const timer = window.setTimeout(() => finish(null), 45000);
    v.onloadedmetadata = () => {
      const d = v.duration;
      if (Number.isFinite(d) && d > 0) finish(d);
      else finish(null);
    };
    v.onerror = () => finish(null);
    v.src = url.trim();
  });
}

/**
 * Returns duration in seconds for Vimeo or direct video URLs; null if unsupported, skipped, or failed.
 */
export async function detectVideoDurationSeconds(url: string): Promise<number | null> {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (isYoutubeUrl(trimmed)) return null;

  if (isVimeoUrl(trimmed)) {
    try {
      return await fetchVimeoDurationSeconds(trimmed);
    } catch {
      return null;
    }
  }

  if (isDirectVideoUrl(trimmed)) {
    try {
      return await fetchDirectVideoDurationSeconds(trimmed);
    } catch {
      return null;
    }
  }

  return null;
}

/** Minutes from seconds, rounded to 2 decimal places (e.g. for lesson duration display and API round-trip). */
export function secondsToDurationMinutesDecimal(seconds: number): number {
  return Math.round((seconds / 60) * 100) / 100;
}

export function lessonSecondsToDurationMinutesField(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "";
  return String(secondsToDurationMinutesDecimal(seconds));
}
