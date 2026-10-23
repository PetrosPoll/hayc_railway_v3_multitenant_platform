import { describe, expect, it } from "vitest";
import { syncBlogPostsIntoConfig } from "./blog-config-sync";

const config = {
  pages: [
    {
      path: "/blog",
      title: "Blog",
      cards: [
        { title: "Παλιό", excerpt: "παλιό απόσπασμα", href: "/blog/old-post", image: "https://cdn.example/old.jpg" },
      ],
    },
    {
      path: "/blog/old-post",
      title: "Παλιό",
      metaDescription: "παλιό απόσπασμα",
      content: "<p>παλιό</p>",
      image: "https://cdn.example/old.jpg",
    },
  ],
};

const sampleConfig = {
  blogSampleCardConfig: {
    title: { el: "Δείγμα άρθρου", en: "Δείγμα άρθρου" },
    excerpt: { el: "παράδειγμα", en: "παράδειγμα" },
    href: "/blog/sample-article",
    image: "/theme/sample.webp",
  },
  blogSampleArticleConfig: {
    title: { el: "Δείγμα άρθρου", en: "Δείγμα άρθρου" },
    metaDescription: { el: "περιγραφή", en: "περιγραφή" },
    content: { el: "<p>δείγμα</p>", en: "<p>δείγμα</p>" },
    image: "/theme/sample.webp",
  },
};

describe("syncBlogPostsIntoConfig", () => {
  it("adds a page and a card copied from the existing article", () => {
    const result = syncBlogPostsIntoConfig(config, [{
      id: 4,
      slug: "neo-arthro",
      title: "Νέο άρθρο",
      excerpt: "νέα περίληψη",
      html: "<p>νέο</p>",
      sitePath: null,
    }]);
    if ("error" in result) throw new Error(result.error);
    const pages = result.config.pages as Array<Record<string, unknown>>;
    const list = pages[0].cards as Array<Record<string, unknown>>;
    expect(list.map((card) => card.href)).toEqual(["/blog/old-post", "/blog/neo-arthro"]);
    expect(list[1].title).toBe("Νέο άρθρο");
    expect(list[1].image).toBe("https://cdn.example/old.jpg");
    const created = pages.find((page) => page.path === "/blog/neo-arthro");
    expect(created).toMatchObject({
      title: "Νέο άρθρο",
      metaDescription: "νέα περίληψη",
      content: "<p>νέο</p>",
      image: "https://cdn.example/old.jpg",
    });
    expect(pages.find((page) => page.path === "/blog/old-post")).toBeTruthy();
    expect(result.paths[4]).toBe("/blog/neo-arthro");
  });

  it("updates the same page when the article is synced again", () => {
    const first = syncBlogPostsIntoConfig(config, [{
      id: 4,
      slug: "neo-arthro",
      title: "Νέο άρθρο",
      excerpt: "νέα περίληψη",
      html: "<p>νέο</p>",
      sitePath: null,
    }]);
    if ("error" in first) throw new Error(first.error);
    const second = syncBlogPostsIntoConfig(first.config, [{
      id: 4,
      slug: "neo-arthro",
      title: "Διορθωμένος τίτλος",
      excerpt: "άλλη περίληψη",
      html: "<p>άλλο</p>",
      sitePath: "/blog/neo-arthro",
    }]);
    if ("error" in second) throw new Error(second.error);
    const pages = second.config.pages as Array<Record<string, unknown>>;
    const matches = pages.filter((page) => page.path === "/blog/neo-arthro");
    expect(matches).toHaveLength(1);
    expect(matches[0].title).toBe("Διορθωμένος τίτλος");
    const cards = (pages[0].cards as Array<Record<string, unknown>>).filter((card) => card.href === "/blog/neo-arthro");
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe("Διορθωμένος τίτλος");
  });

  it("writes bilingual articles and cards from the sample config", () => {
    const result = syncBlogPostsIntoConfig(sampleConfig, [{
      id: 8,
      slug: "neo-arthro",
      title: "Νέο άρθρο",
      excerpt: "νέα περίληψη",
      html: "<p>νέο</p>",
      sitePath: null,
    }]);
    if ("error" in result) throw new Error(result.error);
    const articles = result.config.blogArticles as Array<Record<string, unknown>>;
    const cards = result.config.blogCards as Array<Record<string, unknown>>;
    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({
      title: { el: "Νέο άρθρο", en: "Νέο άρθρο" },
      metaDescription: { el: "νέα περίληψη", en: "νέα περίληψη" },
      content: { el: "<p>νέο</p>", en: "<p>νέο</p>" },
      href: "/blog/neo-arthro",
      slug: "neo-arthro",
      image: "/theme/sample.webp",
    });
    expect(cards[0]).toMatchObject({
      title: { el: "Νέο άρθρο", en: "Νέο άρθρο" },
      excerpt: { el: "νέα περίληψη", en: "νέα περίληψη" },
      href: "/blog/neo-arthro",
    });
    expect(result.config.blogSampleArticleConfig).toEqual(sampleConfig.blogSampleArticleConfig);
    expect(result.paths[8]).toBe("/blog/neo-arthro");
  });
});
