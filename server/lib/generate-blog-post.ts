import { sanitizeBlogHtml } from "./blog-html";

export type GeneratedBlogPost = {
  title: string;
  excerpt: string;
  html: string;
};

function languageName(websiteLanguage: string | null | undefined): "Greek" | "English" {
  const value = (websiteLanguage || "en").toLowerCase();
  return value === "gr" || value === "el" ? "Greek" : "English";
}

export async function generateBlogPost(input: {
  topic: string;
  notes?: string;
  websiteLanguage?: string | null;
}): Promise<GeneratedBlogPost> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const model = process.env.OPENAI_BLOG_MODEL || "gpt-4o";
  const language = languageName(input.websiteLanguage);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You write a blog post for a small business website.",
            `Write in ${language}.`,
            "Return JSON with keys title, excerpt, html.",
            "html uses only p, h2, h3, ul, ol, li, strong, em, a, br, blockquote.",
            "Do not include html, head, body, script, or style tags.",
            "Links in anchors must be absolute http or https URLs.",
            "Write 450 to 700 words. excerpt is one or two sentences.",
          ].join(" "),
        },
        {
          role: "user",
          content: `Topic: ${input.topic}\nNotes: ${input.notes?.trim() || "none"}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = payload.choices?.[0]?.message?.content || "";
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  const data = JSON.parse(cleaned) as { title?: unknown; excerpt?: unknown; html?: unknown };
  const title = String(data.title || "").trim().slice(0, 200);
  const excerpt = String(data.excerpt || "").trim().slice(0, 400);
  const html = sanitizeBlogHtml(String(data.html || ""));
  if (!title || !html) {
    throw new Error("Model returned an empty article");
  }
  return { title, excerpt, html };
}
