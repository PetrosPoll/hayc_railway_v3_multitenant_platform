const ALLOWED = new Set(["p", "h2", "h3", "ul", "ol", "li", "strong", "em", "a", "br", "blockquote"]);

/** Keep a small set of tags so model HTML can be rendered on the live site. */
export function sanitizeBlogHtml(input: string): string {
  let html = input.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  html = html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, tag, attrs) => {
    const name = String(tag).toLowerCase();
    if (!ALLOWED.has(name)) return "";
    if (full.startsWith("</")) return `</${name}>`;
    if (name === "br") return "<br>";
    if (name === "a") {
      const href = /href\s*=\s*"([^"]*)"/i.exec(String(attrs))?.[1]
        || /href\s*=\s*'([^']*)'/i.exec(String(attrs))?.[1]
        || "";
      if (!/^https?:\/\//i.test(href)) return "<a>";
      const safe = href.replace(/"/g, "");
      return `<a href="${safe}" rel="noopener noreferrer" target="_blank">`;
    }
    return `<${name}>`;
  });
  return html.trim();
}

export function slugifyTitle(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "post";
}
