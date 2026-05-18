let loadPromise: Promise<void> | null = null;

export const loadCloudinaryWidget = (): Promise<void> => {
  if (window.cloudinary) {
    return Promise.resolve();
  }
  if (loadPromise) {
    return loadPromise;
  }
  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://widget.cloudinary.com/v2.0/global/all.js";
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Cloudinary widget"));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
};
