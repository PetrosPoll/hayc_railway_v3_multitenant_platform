export const normalizeHost = (rawHost: string): string => {
  return rawHost
    .toLowerCase()
    .trim()
    .replace(/:\d+$/, '')    // strip port
    .replace(/^www\./, '');  // strip www
};
