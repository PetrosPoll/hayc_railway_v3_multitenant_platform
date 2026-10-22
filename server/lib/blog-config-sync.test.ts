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
});
