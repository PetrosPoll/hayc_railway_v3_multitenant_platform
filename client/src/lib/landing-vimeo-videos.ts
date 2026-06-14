export type LandingVimeoVideo = {
  id: string;
  title: string;
  thumbnailUrl: string;
};

/** Thumbnails from Vimeo oEmbed (width=640). Re-fetch via vimeo-oembed if a video is replaced. */
export const LANDING_TESTIMONIAL_VIDEOS: LandingVimeoVideo[] = [
  {
    id: "1124268232",
    title: "Peny Deligiannis",
    thumbnailUrl:
      "https://i.vimeocdn.com/video/2066080547-34eeb7cbdca77d686c7e5d645165f9daf835e24f5e7c5580ad1f28e529721dc8-d_640?region=us",
  },
  {
    id: "1129865306",
    title: "Agapi Apostolopoulou",
    thumbnailUrl:
      "https://i.vimeocdn.com/video/2073373307-a6e56889e457ff27d42d6f60fbdd73b90e8a9b1a7f97877b177ce12c29983b85-d_640?region=us",
  },
];
