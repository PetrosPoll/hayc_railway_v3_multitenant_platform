import { useEffect } from "react";

export function usePreloadImages(urls: string[]) {
  useEffect(() => {
    const links = urls.map((url) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;
      document.head.appendChild(link);
      return link;
    });
    return () => {
      links.forEach((link) => document.head.removeChild(link));
    };
  }, []);
}
