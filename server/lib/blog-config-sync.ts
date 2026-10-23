export type BlogSyncPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  html: string;
  sitePath: string | null;
};

type Located = {
  route: string;
  node: Record<string, unknown>;
  parent: unknown[] | Record<string, unknown>;
  key: number | string;
};

const TITLE_KEYS = /^(title|seoTitle|metaTitle|heading|name)$/i;
const EXCERPT_KEYS = /^(excerpt|description|metaDescription|summary|subtitle)$/i;
const BODY_KEYS = /^(content|html|body|text|article)$/i;

function routeOf(node: Record<string, unknown>): string | null {
  for (const key of ["path", "href", "url", "link", "to"]) {
    const value = node[key];
    if (typeof value === "string" && value.startsWith("/") && /blog/i.test(value)) {
      return value;
    }
  }
  return null;
}

function isListRoute(route: string): boolean {
  const path = route.replace(/\/+$/, "");
  return /\/blog$/i.test(path);
}

function isArticleRoute(route: string): boolean {
  return /blog/i.test(route) && !isListRoute(route);
}

function collect(node: unknown, parent: unknown[] | Record<string, unknown> | null, key: number | string | null, out: Located[]) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => collect(item, node, index, out));
    return;
  }
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  const route = routeOf(record);
  if (route && parent && key != null) {
    out.push({ route, node: record, parent, key });
  }
  for (const [childKey, child] of Object.entries(record)) {
    collect(child, record, childKey, out);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function localeText(current: unknown, text: string): unknown {
  if (isRecord(current) && ("el" in current || "en" in current)) {
    return { ...current, el: text, en: text };
  }
  if (typeof current === "string") return text;
  return { el: text, en: text };
}

function htmlToParagraphs(html: string): string[] {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|h4|li|blockquote|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
  const parts = text.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()];
}

function dateLabel(existing: unknown): { el: string; en: string } {
  if (isRecord(existing) && typeof existing.el === "string" && existing.el && typeof existing.en === "string" && existing.en) {
    return { el: existing.el, en: existing.en };
  }
  const now = new Date();
  return {
    el: new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Athens" }).format(now),
    en: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Athens" }).format(now),
  };
}

function findBlogConfig(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findBlogConfig(item);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(node)) return null;
  if (isRecord(node.blogConfig) && (Array.isArray((node.blogConfig as Record<string, unknown>).posts) || (node.blogConfig as Record<string, unknown>).posts == null)) {
    return node.blogConfig as Record<string, unknown>;
  }
  for (const child of Object.values(node)) {
    const found = findBlogConfig(child);
    if (found) return found;
  }
  return null;
}

function syncBlogConfigPosts(
  next: Record<string, unknown>,
  posts: BlogSyncPost[],
  stalePaths: string[],
): { config: Record<string, unknown>; paths: Record<number, string> } | null {
  const blog = findBlogConfig(next);
  if (!blog) return null;
  const list = (Array.isArray(blog.posts) ? blog.posts : []).filter(isRecord);
  const template = list[0];
  const image = template && typeof template.image === "string" ? template.image : "";
  const paths: Record<number, string> = {};
  const activeSlugs = new Set<string>();

  for (const post of posts) {
    const previousSlug = post.sitePath?.split("/").filter(Boolean).pop() || null;
    const index = list.findIndex((item) => item.slug === post.slug || (previousSlug && item.slug === previousSlug));
    const current = index >= 0 ? list[index] : null;
    const entry = {
      slug: post.slug,
      dateLabel: dateLabel(current?.dateLabel),
      title: localeText(current?.title ?? template?.title, post.title),
      excerpt: localeText(current?.excerpt ?? template?.excerpt, post.excerpt),
      image,
      imageAlt: localeText(current?.imageAlt ?? template?.imageAlt, post.title),
      body: htmlToParagraphs(post.html).map((paragraph) => ({ el: paragraph, en: paragraph })),
    };
    if (index >= 0) list[index] = entry;
    else list.unshift(entry);
    activeSlugs.add(post.slug);
    paths[post.id] = `/blog/${post.slug}`;
  }

  const staleSlugs = new Set(
    stalePaths
      .map((path) => path.split("/").filter(Boolean).pop() || "")
      .filter((slug) => slug && !activeSlugs.has(slug)),
  );
  blog.posts = list.filter((item) => typeof item.slug !== "string" || !staleSlugs.has(item.slug));
  return { config: next, paths };
}

function syncSampleShape(
  next: Record<string, unknown>,
  posts: BlogSyncPost[],
  stalePaths: string[],
): { config: Record<string, unknown>; paths: Record<number, string> } | null {
  const articleTemplate = next.blogSampleArticleConfig;
  const cardTemplate = next.blogSampleCardConfig;
  if (!isRecord(articleTemplate) || !isRecord(cardTemplate)) return null;
  if (typeof cardTemplate.href !== "string" || !cardTemplate.href.startsWith("/")) return null;

  const articles = (Array.isArray(next.blogArticles) ? next.blogArticles : []).filter(isRecord);
  const cards = (Array.isArray(next.blogCards) ? next.blogCards : []).filter(isRecord);
  const paths: Record<number, string> = {};
  const activePaths = new Set<string>();
  const image = typeof articleTemplate.image === "string"
    ? articleTemplate.image
    : typeof cardTemplate.image === "string" ? cardTemplate.image : "";

  for (const post of posts) {
    const existingRoute = post.sitePath && (articles.some((item) => item.href === post.sitePath) || cards.some((item) => item.href === post.sitePath))
      ? post.sitePath
      : null;
    const route = existingRoute || `/blog/${post.slug}`;
    activePaths.add(route);
    paths[post.id] = route;

    const article = {
      title: localeText(articleTemplate.title, post.title),
      metaDescription: localeText(articleTemplate.metaDescription, post.excerpt),
      content: localeText(articleTemplate.content, post.html),
      image,
      href: route,
      slug: post.slug,
    };
    const card = {
      title: localeText(cardTemplate.title, post.title),
      excerpt: localeText(cardTemplate.excerpt, post.excerpt),
      href: route,
      image: typeof cardTemplate.image === "string" ? cardTemplate.image : image,
    };
    const articleIndex = articles.findIndex((item) => item.href === route || item.slug === post.slug);
    if (articleIndex >= 0) articles[articleIndex] = article;
    else articles.unshift(article);
    const cardIndex = cards.findIndex((item) => item.href === route);
    if (cardIndex >= 0) cards[cardIndex] = card;
    else cards.unshift(card);
  }

  const stale = new Set(stalePaths.filter((path) => !activePaths.has(path)));
  next.blogArticles = articles.filter((item) => typeof item.href !== "string" || !stale.has(item.href));
  next.blogCards = cards.filter((item) => typeof item.href !== "string" || !stale.has(item.href));
  return { config: next, paths };
}

function routeForSlug(templateRoute: string, slug: string): string {
  const trimmed = templateRoute.replace(/\/+$/, "");
  const parts = trimmed.split("/");
  const last = parts[parts.length - 1] || "";
  if (/^blog(-details)?$/i.test(last)) return `${trimmed}/${slug}`;
  parts[parts.length - 1] = slug;
  return parts.join("/");
}

function fill(value: unknown, fromRoute: string, post: BlogSyncPost, nextRoute: string, top = true): unknown {
  if (typeof value === "string") return value === fromRoute ? nextRoute : value;
  if (Array.isArray(value)) return value.map((item) => fill(item, fromRoute, post, nextRoute, false));
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (top && TITLE_KEYS.test(key) && (typeof child === "string" || isRecord(child))) output[key] = localeText(child, post.title);
    else if (top && EXCERPT_KEYS.test(key) && (typeof child === "string" || isRecord(child))) output[key] = localeText(child, post.excerpt);
    else if (top && BODY_KEYS.test(key) && (typeof child === "string" || isRecord(child))) output[key] = localeText(child, post.html);
    else if (top && key === "slug" && typeof child === "string") output[key] = post.slug;
    else output[key] = fill(child, fromRoute, post, nextRoute, false);
  }
  return output;
}

function place(parent: Located["parent"], key: number | string, value: Record<string, unknown>) {
  if (Array.isArray(parent)) {
    if (typeof key === "number") parent[key] = value;
    else parent.push(value);
    return;
  }
  parent[String(key)] = value;
}

function cardArrays(config: Record<string, unknown>, articleRoutes: Set<string>): unknown[][] {
  const arrays: unknown[][] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      const links = node.filter((item) => item && typeof item === "object" && articleRoutes.has(routeOf(item as Record<string, unknown>) || ""));
      if (links.length > 0) arrays.push(node);
      node.forEach(visit);
      return;
    }
    if (node && typeof node === "object") Object.values(node).forEach(visit);
  };
  visit(config);
  return arrays;
}

export function syncBlogPostsIntoConfig(
  config: Record<string, unknown>,
  posts: BlogSyncPost[],
  stalePaths: string[] = [],
): { config: Record<string, unknown>; paths: Record<number, string> } | { error: string } {
  const next = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
  const blogList = syncBlogConfigPosts(next, posts, stalePaths);
  if (blogList) return blogList;
  const sample = syncSampleShape(next, posts, stalePaths);
  if (sample) return sample;
  const located = [] as Located[];
  collect(next, null, null, located);
  const articles = located.filter((item) => isArticleRoute(item.route));
  if (articles.length === 0) {
    return { error: "Αυτό το site δεν έχει σελίδα άρθρου στο config, οπότε ο συγχρονισμός δεν μπορεί να προσθέσει άρθρο." };
  }
  const template = articles[0];
  const articleRoutes = new Set(articles.map((item) => item.route));
  const lists = cardArrays(next, articleRoutes);
  if (lists.length === 0) {
    return { error: "Η λίστα του blog στο config δεν έχει κάρτες άρθρων, οπότε ο συγχρονισμός δεν μπορεί να προσθέσει κάρτα." };
  }

  const paths: Record<number, string> = {};
  const activePaths = new Set<string>();

  for (const post of posts) {
    const nextRoute = post.sitePath && articles.some((item) => item.route === post.sitePath)
      ? post.sitePath
      : routeForSlug(template.route, post.slug);
    activePaths.add(nextRoute);
    paths[post.id] = nextRoute;

    const fresh = collectFresh(next);
    const existingPage = fresh.find((item) => item.route === nextRoute);
    const page = fill(
      JSON.parse(JSON.stringify(existingPage?.node || template.node)),
      template.route,
      post,
      nextRoute,
    ) as Record<string, unknown>;
    if (existingPage) place(existingPage.parent, existingPage.key, page);
    else if (Array.isArray(template.parent)) template.parent.push(page);
    else template.parent[post.slug] = page;

    for (const list of cardArrays(next, new Set([...articleRoutes, nextRoute]))) {
      const templateCard = list.find((item) => item && typeof item === "object" && routeOf(item as Record<string, unknown>) === template.route) as Record<string, unknown> | undefined;
      const currentCardIndex = list.findIndex((item) => item && typeof item === "object" && routeOf(item as Record<string, unknown>) === nextRoute);
      const card = fill(
        JSON.parse(JSON.stringify(currentCardIndex >= 0 ? list[currentCardIndex] : templateCard || list[0])),
        template.route,
        post,
        nextRoute,
      ) as Record<string, unknown>;
      if (currentCardIndex >= 0) list[currentCardIndex] = card;
      else list.push(card);
    }
  }

  const stale = new Set(stalePaths.filter((path) => !activePaths.has(path)));
  if (stale.size > 0) {
    const after = [] as Located[];
    collect(next, null, null, after);
    const stalePages = after.filter((item) => stale.has(item.route));
    for (const item of stalePages.sort((a, b) => Number(b.key) - Number(a.key))) {
      if (Array.isArray(item.parent) && typeof item.key === "number") item.parent.splice(item.key, 1);
      else delete (item.parent as Record<string, unknown>)[String(item.key)];
    }
    for (const list of cardArrays(next, new Set([...articleRoutes, ...stale]))) {
      for (let index = list.length - 1; index >= 0; index -= 1) {
        const item = list[index];
        if (!item || typeof item !== "object") continue;
        const route = routeOf(item as Record<string, unknown>);
        if (route && stale.has(route)) list.splice(index, 1);
      }
    }
  }

  return { config: next, paths };
}

function collectFresh(config: Record<string, unknown>): Located[] {
  const located = [] as Located[];
  collect(config, null, null, located);
  return located.filter((item) => isArticleRoute(item.route));
}
