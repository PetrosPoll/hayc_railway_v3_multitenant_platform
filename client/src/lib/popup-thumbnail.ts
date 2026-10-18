import html2canvas from "html2canvas";

/** Convert a remote Unlayer export URL into a durable data URL. */
export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Render Unlayer HTML into a square thumbnail data URL (fallback when
 * unlayer.exportImage returns null).
 */
export async function htmlToThumbnailDataUrl(
  html: string,
  size = 800,
): Promise<string | null> {
  if (!html?.trim()) return null;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${size}px`,
    height: `${size}px`,
    border: "0",
    opacity: "0",
    pointerEvents: "none",
    background: "#fff",
  });
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) return null;

    doc.open();
    doc.write(html);
    doc.close();

    // Wait for layout / images (best-effort)
    await new Promise((r) => setTimeout(r, 400));
    const imgs = Array.from(doc.images || []);
    await Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(resolve, 1500);
              }),
      ),
    );

    const target = doc.body;
    if (!target) return null;

    const canvas = await html2canvas(target, {
      width: size,
      height: size,
      windowWidth: size,
      windowHeight: size,
      backgroundColor: "#ffffff",
      scale: 1,
      useCORS: true,
      logging: false,
    });

    return canvas.toDataURL("image/jpeg", 0.82);
  } catch (err) {
    console.warn("htmlToThumbnailDataUrl failed:", err);
    return null;
  } finally {
    iframe.remove();
  }
}

export async function resolvePopupThumbnail(opts: {
  unlayerUrl: string | null | undefined;
  html: string;
}): Promise<string | null> {
  if (opts.unlayerUrl) {
    const persisted = await urlToDataUrl(opts.unlayerUrl);
    if (persisted) return persisted;
    // Unlayer CDN URL may still work as img src for a while
    if (opts.unlayerUrl.startsWith("http")) return opts.unlayerUrl;
  }
  return htmlToThumbnailDataUrl(opts.html);
}
