import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useDemoMode } from "@/hooks/use-demo-mode";

type BlogPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  html: string;
  topic: string | null;
  published: boolean;
  publishedAt: string | null;
  sitePath: string | null;
  syncedAt: string | null;
  updatedAt: string | null;
};

type BlogUsage = {
  count: number;
  recommended: number;
  limit: number;
};

type EditorState = {
  id: number | null;
  title: string;
  excerpt: string;
  html: string;
  topic: string;
  notes: string;
  published: boolean;
};

const emptyEditor: EditorState = {
  id: null,
  title: "",
  excerpt: "",
  html: "",
  topic: "",
  notes: "",
  published: false,
};

async function readError(response: Response) {
  const data = await response.json().catch(() => ({}));
  return data.error || "Request failed";
}

export function BlogPanel({ websiteId }: { websiteId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { blockIfDemo } = useDemoMode();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [allowExtra, setAllowExtra] = useState(false);
  const [section, setSection] = useState("topic");
  const [menuOpen, setMenuOpen] = useState(false);

  const postsQuery = useQuery<{ posts: BlogPost[]; usage: BlogUsage }>({
    queryKey: ["/api/websites", websiteId, "blog"],
    queryFn: async () => {
      const response = await fetch(`/api/websites/${websiteId}/blog`, { credentials: "include" });
      if (!response.ok) throw new Error(await readError(response));
      return response.json();
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/websites", websiteId, "blog"] });
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/websites/${websiteId}/blog/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          topic: editor.topic,
          notes: editor.notes,
          confirmOverRecommended: allowExtra,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      return response.json() as Promise<{ post: BlogPost }>;
    },
    onSuccess: ({ post }) => {
      setAllowExtra(false);
      setEditor({
        id: post.id,
        title: post.title,
        excerpt: post.excerpt,
        html: post.html,
        topic: post.topic || editor.topic,
        notes: editor.notes,
        published: post.published,
      });
      invalidate();
      setSection("editor");
      toast({ description: t("dashboard.blogGenerated") || "Article created" });
    },
    onError: (error: Error) => {
      toast({ description: error.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (published: boolean) => {
      const payload = {
        title: editor.title,
        excerpt: editor.excerpt,
        html: editor.html,
        topic: editor.topic,
        published,
      };
      const response = await fetch(
        editor.id
          ? `/api/websites/${websiteId}/blog/${editor.id}`
          : `/api/websites/${websiteId}/blog`,
        {
          method: editor.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      return response.json() as Promise<BlogPost>;
    },
    onSuccess: (post) => {
      setEditor((current) => ({
        ...current,
        id: post.id,
        title: post.title,
        excerpt: post.excerpt,
        html: post.html,
        published: post.published,
      }));
      invalidate();
      toast({
        description: post.published
          ? t("dashboard.blogMarkedForSync") || "Marked for sync. It is not on the site until you sync."
          : t("dashboard.blogDraftSaved") || "Draft saved in the dashboard. It is not on the site yet.",
      });
    },
    onError: (error: Error) => {
      toast({ description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: number) => {
      const response = await fetch(`/api/websites/${websiteId}/blog/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await readError(response));
    },
    onSuccess: () => {
      setEditor(emptyEditor);
      invalidate();
    },
    onError: (error: Error) => {
      toast({ description: error.message, variant: "destructive" });
    },
  });

  const loadPost = (post: BlogPost) => {
    setEditor({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt,
      html: post.html,
      topic: post.topic || "",
      notes: "",
      published: post.published,
    });
    setSection("editor");
  };

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/websites/${websiteId}/blog/sync`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await readError(response));
      return response.json() as Promise<{ count: number }>;
    },
    onSuccess: (result) => {
      invalidate();
      toast({
        description: t("dashboard.blogSyncDone", { count: result.count }) || "Synced to the website",
      });
    },
    onError: (error: Error) => {
      toast({ description: error.message, variant: "destructive" });
    },
  });

  const usage = postsQuery.data?.usage;
  const count = usage?.count ?? 0;
  const atHardLimit = count >= (usage?.limit ?? 15);
  const needsConfirm = count >= (usage?.recommended ?? 7) && !atHardLimit;
  const posts = postsQuery.data?.posts || [];
  const sections = [
    { value: "topic", label: t("dashboard.blogTabTopic") || "Topic" },
    { value: "editor", label: t("dashboard.blogTabEditor") || "Edit" },
    { value: "articles", label: t("dashboard.blogTabArticles") || "Articles" },
  ];
  const currentSection = sections.find((item) => item.value === section) || sections[0];
  const hasChangesSinceSync = posts.some((post) => {
    if (post.published) {
      if (!post.syncedAt || !post.sitePath) return true;
      return Boolean(post.updatedAt && new Date(post.updatedAt) > new Date(post.syncedAt));
    }
    return Boolean(post.sitePath);
  });

  return (
    <div className="space-y-6" data-testid="section-blog">
      {generateMutation.isPending ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6"
          data-testid="blog-generating-overlay"
        >
          <div className="max-w-md rounded-lg border bg-background p-6 text-center shadow-lg">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
            <p className="text-base font-medium">
              {t("dashboard.blogGeneratingTitle") || "Creating the article"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("dashboard.blogGeneratingWait") || "This usually takes about 30 seconds."}
            </p>
          </div>
        </div>
      ) : null}
      <div>
        <h2 className="text-2xl font-semibold">{t("dashboard.blog") || "Blog"}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("dashboard.blogDescription") ||
            "Write a topic. The article is created as a draft for you to review."}
        </p>
        <p className="text-sm mt-2" data-testid="blog-usage">
          {t("dashboard.blogUsage", { count }) || `${count} / 7 recommended this month`}
        </p>
        {atHardLimit ? (
          <p className="text-sm text-destructive mt-2" data-testid="blog-monthly-limit">
            {t("dashboard.blogMonthlyLimit") ||
              "You have reached 15 articles this month. New articles will be available next month."}
          </p>
        ) : null}
        {needsConfirm ? (
          <p className="text-sm mt-2" data-testid="blog-recommended-warning">
            {t("dashboard.blogRecommendedWarning") ||
              "We recommend up to 7 articles a month. Fewer, better articles help Google ranking more than many articles at once. You can continue if you want."}
          </p>
        ) : null}
      </div>

      <Tabs value={section} onValueChange={setSection}>
        <div className="flex items-center justify-between sm:hidden">
          <span className="text-sm font-medium">{currentSection.label}</span>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("dashboard.blogMenu") || "Menu"} data-testid="blog-menu">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>{t("dashboard.blog") || "Blog"}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-2">
                {sections.map((item) => (
                  <Button
                    key={item.value}
                    variant={item.value === section ? "default" : "ghost"}
                    className="justify-start"
                    onClick={() => {
                      setSection(item.value);
                      setMenuOpen(false);
                    }}
                    data-testid={`blog-menu-${item.value}`}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <TabsList className="hidden h-auto w-full grid-cols-3 sm:grid" data-testid="blog-tabs">
          {sections.map((item) => (
            <TabsTrigger key={item.value} className="whitespace-normal px-2 py-2 text-center" value={item.value} data-testid={`blog-tab-${item.value}`}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

      <TabsContent value="topic" className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.blogTopic") || "Topic"}</CardTitle>
          <CardDescription>
            {t("dashboard.blogTopicHint") || "Describe what the article should say. You can edit the result afterwards."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={editor.topic}
            onChange={(event) => setEditor((current) => ({ ...current, topic: event.target.value }))}
            placeholder={t("dashboard.blogTopicPlaceholder") || "e.g. Why book a summer AC service"}
            data-testid="input-blog-topic"
          />
          <div className="space-y-2">
            <Label htmlFor="blog-notes">{t("dashboard.blogNotes") || "Extra notes"}</Label>
            <Textarea
              id="blog-notes"
              value={editor.notes}
              onChange={(event) => setEditor((current) => ({ ...current, notes: event.target.value }))}
              placeholder={t("dashboard.blogNotesPlaceholder") || "Tone, city, offer, words to include"}
              data-testid="input-blog-notes"
            />
          </div>
          {needsConfirm && !allowExtra ? (
            <Button
              variant="outline"
              onClick={() => setAllowExtra(true)}
              data-testid="button-blog-continue"
            >
              {t("dashboard.blogContinue") || "Continue"}
            </Button>
          ) : null}
          <Button
            onClick={() => {
              if (blockIfDemo()) return;
              generateMutation.mutate();
            }}
            disabled={
              generateMutation.isPending ||
              editor.topic.trim().length < 3 ||
              atHardLimit ||
              (needsConfirm && !allowExtra)
            }
            data-testid="button-blog-generate"
          >
            {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("dashboard.blogGenerate") || "Create with AI"}
          </Button>
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="editor" className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.blogArticle") || "Article"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="blog-title">{t("dashboard.blogTitle") || "Title"}</Label>
            <Input
              id="blog-title"
              value={editor.title}
              onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))}
              data-testid="input-blog-title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="blog-excerpt">{t("dashboard.blogExcerpt") || "Excerpt"}</Label>
            <Textarea
              id="blog-excerpt"
              value={editor.excerpt}
              onChange={(event) => setEditor((current) => ({ ...current, excerpt: event.target.value }))}
              data-testid="input-blog-excerpt"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="blog-html">{t("dashboard.blogBody") || "Body"}</Label>
            <Textarea
              id="blog-html"
              className="min-h-[220px] font-mono text-xs"
              value={editor.html}
              onChange={(event) => setEditor((current) => ({ ...current, html: event.target.value }))}
              data-testid="input-blog-html"
            />
          </div>
          {editor.html ? (
            <div
              className="prose prose-sm max-w-none rounded-md border p-4"
              data-testid="blog-preview"
              dangerouslySetInnerHTML={{ __html: editor.html }}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={saveMutation.isPending || !editor.title.trim() || !editor.html.trim()}
              onClick={() => {
                if (blockIfDemo()) return;
                saveMutation.mutate(false);
              }}
              data-testid="button-blog-save"
            >
              {t("dashboard.blogSaveDraft") || "Save draft"}
            </Button>
            <Button
              disabled={saveMutation.isPending || !editor.title.trim() || !editor.html.trim()}
              onClick={() => {
                if (blockIfDemo()) return;
                saveMutation.mutate(true);
              }}
              data-testid="button-blog-publish"
            >
              {t("dashboard.blogMarkReady") || "Ready to sync"}
            </Button>
            {editor.id ? (
              <Button
                variant="ghost"
                onClick={() => {
                  if (blockIfDemo()) return;
                  deleteMutation.mutate(editor.id!);
                }}
                data-testid="button-blog-delete"
              >
                {t("dashboard.blogDelete") || "Delete"}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="articles" className="mt-4 space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (blockIfDemo()) return;
                syncMutation.mutate();
              }}
              disabled={syncMutation.isPending || !hasChangesSinceSync}
              data-testid="button-sync-blog-to-website"
            >
              {syncMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {syncMutation.isPending
                ? t("dashboard.blogSyncing") || "Syncing..."
                : t("dashboard.blogSync") || "Sync to website"}
            </Button>
            <span className={`text-sm ${hasChangesSinceSync ? "text-amber-600" : "text-green-600"}`}>
              {hasChangesSinceSync
                ? t("dashboard.blogSyncPending") || "Changes are not on the site yet"
                : t("dashboard.blogSyncUpToDate") || "The site is up to date"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.blogSyncHint") || "Sync writes each ready article as its own page and adds its card to the blog list."}
          </p>
        </CardContent>
      </Card>
      <div className="space-y-3" data-testid="blog-list">
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.blogEmpty") || "No articles yet"}</p>
        ) : (
          posts.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => loadPost(post)}
              className={`w-full text-left rounded-md border p-4 hover:bg-muted/40 ${editor.id === post.id ? "border-primary" : ""}`}
              data-testid={`blog-post-${post.id}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{post.title}</span>
                <Badge variant={post.published ? "default" : "secondary"}>
                  {post.published
                    ? post.syncedAt
                      ? t("dashboard.blogSynced") || "Synced"
                      : t("dashboard.blogReady") || "Ready"
                    : t("dashboard.blogDraft") || "Draft"}
                </Badge>
              </div>
              {post.excerpt ? (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.excerpt}</p>
              ) : null}
            </button>
          ))
        )}
      </div>
      </TabsContent>
      </Tabs>
    </div>
  );
}
