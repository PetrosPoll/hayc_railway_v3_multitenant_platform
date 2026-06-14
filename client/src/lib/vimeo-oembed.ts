type VimeoOEmbed = {
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
};

export async function fetchVimeoThumbnail(
  videoId: string,
  width = 640,
): Promise<string | null> {
  const pageUrl = `https://vimeo.com/${videoId}`;
  const endpoint = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(pageUrl)}&width=${width}`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;

    const data = (await res.json()) as VimeoOEmbed;
    return typeof data.thumbnail_url === "string" ? data.thumbnail_url : null;
  } catch {
    return null;
  }
}
