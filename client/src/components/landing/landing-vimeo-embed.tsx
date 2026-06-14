import { Play } from "lucide-react";
import { useState } from "react";

type LandingVimeoEmbedProps = {
  videoId: string;
  title: string;
};

export function LandingVimeoEmbed({ videoId, title }: LandingVimeoEmbedProps) {
  const [playing, setPlaying] = useState(false);
  const thumbnailUrl = `https://vumbnail.com/${videoId}.jpg`;

  if (playing) {
    return (
      <iframe
        src={`https://player.vimeo.com/video/${videoId}?autoplay=1`}
        width="100%"
        height="100%"
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
        title={title}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group relative block h-full w-full overflow-hidden bg-black text-left"
      aria-label={title}
    >
      <img
        src={thumbnailUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/35 transition-colors group-hover:bg-black/45">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ED4C14] text-white shadow-lg">
          <Play className="h-7 w-7 fill-current" aria-hidden />
        </span>
      </span>
    </button>
  );
}
