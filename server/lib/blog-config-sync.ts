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
